import { Server, Socket } from 'socket.io';
import { getPlayerBySocketId, getPlayersInRoom, updatePlayerHand } from '../../player.queries';
import { getGame, updateTrumpDeclaration, updateRoundKing, updateKitty } from '../../game.queries';
import { parseCard, parseHand, getKittySize } from '../../deck';
import { DeclareTrumpPayload } from '../../types';
import { MAX_PLAYERS } from '../../constants';
import { startTrick } from './trick';
import { isRoomFrozen } from '../freeze';

export function registerTrumpHandlers(io: Server, socket: Socket) {
  socket.on('declare-trump', (payload: DeclareTrumpPayload) => {
    const { gameId, card } = payload;

    const game = getGame(gameId);
    if (!game) {
      socket.emit('room-error', { message: 'Game not found' });
      return;
    }

    if (isRoomFrozen(game.room_id)) {
      socket.emit('game-paused', { reason: 'A player is disconnected' });
      return;
    }

    if (game.trump_count >= 2 && (game.trump_suit === 'BJ' || game.trump_suit === 'SJ')) {
      socket.emit('room-error', { message: 'Trump declaration is already final' });
      return;
    }

    const player = getPlayerBySocketId(socket.id);
    if (!player) {
      socket.emit('room-error', { message: 'Player not found' });
      return;
    }

    const { suit, rank } = parseCard(card);

    const isFirstRound = game.round_number === 1;

    const hand = parseHand(player);

    if (suit === 'J') {
      const matchingJokers = hand.filter((c) => {
        const parsed = parseCard(c);
        return parsed.suit === 'J' && parsed.rank === rank;
      });
      if (matchingJokers.length < 2) {
        socket.emit('room-error', { message: 'You need a pair of jokers to declare no trump suit' });
        return;
      }
      const jokerTrumpSuit = rank === 'B' ? 'BJ' : 'SJ';
      updateTrumpDeclaration(gameId, jokerTrumpSuit, player.player_id, 2);
      if (isFirstRound) {
        updateRoundKing(gameId, player.player_id);
      }
      io.to(game.room_id).emit('trump-declared', {
        trumpSuit: jokerTrumpSuit,
        declarerId: player.player_id,
        isPair: true,
        roundKingId: isFirstRound ? player.player_id : game.round_king,
      });
      return;
    }

    if (rank !== game.trump_number) {
      socket.emit('room-error', { message: 'Card rank does not match trump number' });
      return;
    }

    if (game.trump_count >= 2) {
      socket.emit('room-error', { message: 'Only double jokers can override a pair declaration' });
      return;
    }

    const matchingCards = hand.filter((c) => {
      const parsed = parseCard(c);
      return parsed.suit === suit && parsed.rank === rank;
    });

    if (matchingCards.length === 0) {
      socket.emit('room-error', { message: 'You do not have this card' });
      return;
    }

    if (game.trump_count === 0) {
      const wantPair = payload.wantPair === true;
      if (wantPair) {
        if (matchingCards.length < 2) {
          socket.emit('room-error', { message: 'You need a pair to declare a pair' });
          return;
        }
        updateTrumpDeclaration(gameId, suit, player.player_id, 2);
        if (isFirstRound) {
          updateRoundKing(gameId, player.player_id);
        }
        io.to(game.room_id).emit('trump-declared', {
          trumpSuit: suit,
          declarerId: player.player_id,
          isPair: true,
          roundKingId: isFirstRound ? player.player_id : game.round_king,
        });
      } else {
        updateTrumpDeclaration(gameId, suit, player.player_id, 1);
        if (isFirstRound) {
          updateRoundKing(gameId, player.player_id);
        }
        io.to(game.room_id).emit('trump-declared', {
          trumpSuit: suit,
          declarerId: player.player_id,
          isPair: false,
          roundKingId: isFirstRound ? player.player_id : game.round_king,
        });
      }
    } else if (game.trump_count === 1) {
      if (matchingCards.length < 2) {
        const isReinforce = player.player_id === game.trump_declarer && suit === game.trump_suit;
        socket.emit('room-error', {
          message: isReinforce ? 'You need a pair to reinforce' : 'You need a pair to override the current declaration',
        });
      } else {
        updateTrumpDeclaration(gameId, suit, player.player_id, 2);
        if (isFirstRound) {
          updateRoundKing(gameId, player.player_id);
        }
        io.to(game.room_id).emit('trump-declared', {
          trumpSuit: suit,
          declarerId: player.player_id,
          isPair: true,
          roundKingId: isFirstRound ? player.player_id : game.round_king,
        });
      }
    }
  });

  socket.on('pick-up-kitty', (payload: { gameId: string }) => {
    const { gameId } = payload;

    const game = getGame(gameId);
    if (!game) {
      socket.emit('room-error', { message: 'Game not found' });
      return;
    }

    if (isRoomFrozen(game.room_id)) {
      socket.emit('game-paused', { reason: 'A player is disconnected' });
      return;
    }

    const player = getPlayerBySocketId(socket.id);
    if (!player || player.player_id !== game.round_king) {
      socket.emit('room-error', { message: 'Only the round king can pick up the kitty' });
      return;
    }

    const kittyCards: string[] = JSON.parse(game.kitty as string);

    socket.emit('kitty-picked-up', { kittyCards });
    socket.to(game.room_id).emit('kitty-picked-up', {});
  });

  socket.on('finish-kitty', (payload: { gameId: string; kittyCards: string[]; handCards: string[] }) => {
    const { gameId, kittyCards, handCards } = payload;

    const game = getGame(gameId);
    if (!game) {
      socket.emit('room-error', { message: 'Game not found' });
      return;
    }

    if (isRoomFrozen(game.room_id)) {
      socket.emit('game-paused', { reason: 'A player is disconnected' });
      return;
    }

    const player = getPlayerBySocketId(socket.id);
    if (!player || player.player_id !== game.round_king) {
      socket.emit('room-error', { message: 'Only the round king can finish the kitty' });
      return;
    }

    const players = getPlayersInRoom(game.room_id).slice(0, MAX_PLAYERS);
    const expectedKittySize = getKittySize(players.length);
    if (kittyCards.length !== expectedKittySize) {
      socket.emit('room-error', { message: `Kitty must contain exactly ${expectedKittySize} cards` });
      return;
    }

    updateKitty(gameId, kittyCards);
    updatePlayerHand(player.player_id, handCards);

    io.to(game.room_id).emit('kitty-finished', {});

    const kingIndex = players.findIndex(p => p.player_id === game.round_king);
    const playerOrder = players.map((_, i) => players[(kingIndex + i) % players.length].player_id);

    startTrick(io, gameId, game.room_id, game.round_king!, 1, playerOrder);
  });
}
