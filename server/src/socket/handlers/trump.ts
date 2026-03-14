import { Server, Socket } from 'socket.io';
import { EVENTS } from '../../../../shared/events';
import { getPlayerBySocketId, getPlayersInRoom, updatePlayerHand } from '../../db/player.queries';
import { getGame, updateTrumpDeclaration, updateRoundKing, updateKitty, updateGamePhase, updateKingFromDeclaration } from '../../db/game.queries';
import { parseCard, parseHand, getKittySize } from '../../game/deck';
import { DeclareTrumpPayload } from '../../types';
import { MAX_PLAYERS } from '../../game/constants';
import { startTrick } from './trick';
import { trickStates, singleDeclarerState } from '../state';

export function registerTrumpHandlers(io: Server, socket: Socket) {
  socket.on(EVENTS.DECLARE_TRUMP, (payload: DeclareTrumpPayload) => {
    const { gameId, card } = payload;

    const game = getGame(gameId);
    if (!game) {
      socket.emit(EVENTS.ROOM_ERROR, { message: 'Game not found' });
      return;
    }

    if (game.phase === 'kitty') {
      socket.emit(EVENTS.ROOM_ERROR, { message: 'Trump declaration is not allowed after the kitty has been picked up' });
      return;
    }

    if (game.trump_count >= 2 && (game.trump_suit === 'BJ' || game.trump_suit === 'SJ')) {
      socket.emit(EVENTS.ROOM_ERROR, { message: 'Trump declaration is already final' });
      return;
    }

    const player = getPlayerBySocketId(socket.id);
    if (!player) {
      socket.emit(EVENTS.ROOM_ERROR, { message: 'Player not found' });
      return;
    }

    const { suit, rank } = parseCard(card);

    const kingUnassigned = game.round_king === null;

    const hand = parseHand(player);

    if (suit === 'J') {
      const matchingJokers = hand.filter((c) => {
        const parsed = parseCard(c);
        return parsed.suit === 'J' && parsed.rank === rank;
      });
      if (matchingJokers.length < 2) {
        socket.emit(EVENTS.ROOM_ERROR, { message: 'You need a pair of jokers to declare no trump suit' });
        return;
      }
      const jokerTrumpSuit = rank === 'B' ? 'BJ' : 'SJ';
      updateTrumpDeclaration(gameId, jokerTrumpSuit, player.player_id, 2);
      singleDeclarerState.delete(gameId);
      const jokerBecomesKing = kingUnassigned || game.king_from_declaration === 1;
      if (jokerBecomesKing) {
        updateRoundKing(gameId, player.player_id);
        updateKingFromDeclaration(gameId, false);
      }
      io.to(game.room_id).emit(EVENTS.TRUMP_DECLARED, {
        trumpSuit: jokerTrumpSuit,
        declarerId: player.player_id,
        isPair: true,
        roundKingId: jokerBecomesKing ? player.player_id : game.round_king,
      });
      return;
    }

    if (rank !== game.trump_number) {
      socket.emit(EVENTS.ROOM_ERROR, { message: 'Card rank does not match trump number' });
      return;
    }

    if (game.trump_count >= 2) {
      socket.emit(EVENTS.ROOM_ERROR, { message: 'Only double jokers can override a pair declaration' });
      return;
    }

    const matchingCards = hand.filter((c) => {
      const parsed = parseCard(c);
      return parsed.suit === suit && parsed.rank === rank;
    });

    if (matchingCards.length === 0) {
      socket.emit(EVENTS.ROOM_ERROR, { message: 'You do not have this card' });
      return;
    }

    if (game.trump_count === 0) {
      const wantPair = payload.wantPair === true;
      if (wantPair) {
        if (matchingCards.length < 2) {
          socket.emit(EVENTS.ROOM_ERROR, { message: 'You need a pair to declare a pair' });
          return;
        }
        updateTrumpDeclaration(gameId, suit, player.player_id, 2);
        if (kingUnassigned) {
          updateRoundKing(gameId, player.player_id);
          updateKingFromDeclaration(gameId, true);
        }
        io.to(game.room_id).emit(EVENTS.TRUMP_DECLARED, {
          trumpSuit: suit,
          declarerId: player.player_id,
          isPair: true,
          roundKingId: kingUnassigned ? player.player_id : game.round_king,
        });
      } else {
        updateTrumpDeclaration(gameId, suit, player.player_id, 1);
        singleDeclarerState.set(gameId, { playerId: player.player_id, card });
        if (kingUnassigned) {
          updateRoundKing(gameId, player.player_id);
          updateKingFromDeclaration(gameId, true);
        }
        io.to(game.room_id).emit(EVENTS.TRUMP_DECLARED, {
          trumpSuit: suit,
          declarerId: player.player_id,
          isPair: false,
          roundKingId: kingUnassigned ? player.player_id : game.round_king,
        });
      }
    } else if (game.trump_count === 1) {
      if (matchingCards.length < 2) {
        const isReinforce = player.player_id === game.trump_declarer && suit === game.trump_suit;
        socket.emit(EVENTS.ROOM_ERROR, {
          message: isReinforce ? 'You need a pair to reinforce' : 'You need a pair to override the current declaration',
        });
      } else {
        const prevSingleDeclarer = singleDeclarerState.get(gameId);
        const isOverride = prevSingleDeclarer && player.player_id !== prevSingleDeclarer.playerId;
        updateTrumpDeclaration(gameId, suit, player.player_id, 2);
        if (!isOverride) {
          // Self-reinforcement or no prior single state: window is closed
          singleDeclarerState.delete(gameId);
        }
        const overriderBecomesKing = kingUnassigned || (!!isOverride && game.king_from_declaration === 1);
        if (overriderBecomesKing) {
          updateRoundKing(gameId, player.player_id);
          if (kingUnassigned) updateKingFromDeclaration(gameId, true);
        }
        io.to(game.room_id).emit(EVENTS.TRUMP_DECLARED, {
          trumpSuit: suit,
          declarerId: player.player_id,
          isPair: true,
          roundKingId: overriderBecomesKing ? player.player_id : game.round_king,
        });
        if (isOverride) {
          io.to(game.room_id).emit(EVENTS.CAN_REINFORCE, {
            targetPlayerId: prevSingleDeclarer!.playerId,
            card: prevSingleDeclarer!.card,
          });
        }
      }
    }
  });

  socket.on(EVENTS.REINFORCE_TRUMP, (payload: { gameId: string }) => {
    const { gameId } = payload;

    const game = getGame(gameId);
    if (!game) {
      socket.emit(EVENTS.ROOM_ERROR, { message: 'Game not found' });
      return;
    }

    if (game.phase === 'kitty') {
      socket.emit(EVENTS.ROOM_ERROR, { message: 'Cannot reinforce after the kitty has been picked up' });
      return;
    }

    if (game.trump_count !== 2 || game.trump_suit === 'BJ' || game.trump_suit === 'SJ') {
      socket.emit(EVENTS.ROOM_ERROR, { message: 'Cannot reinforce at this time' });
      return;
    }

    const prevSingleDeclarer = singleDeclarerState.get(gameId);
    if (!prevSingleDeclarer) {
      socket.emit(EVENTS.ROOM_ERROR, { message: 'No single declaration to reinforce' });
      return;
    }

    const player = getPlayerBySocketId(socket.id);
    if (!player || player.player_id !== prevSingleDeclarer.playerId) {
      socket.emit(EVENTS.ROOM_ERROR, { message: 'Only the original single declarer can reinforce' });
      return;
    }

    const { suit, rank } = parseCard(prevSingleDeclarer.card);
    const hand = parseHand(player);
    const matchingCards = hand.filter((c) => {
      const parsed = parseCard(c);
      return parsed.suit === suit && parsed.rank === rank;
    });

    if (matchingCards.length < 2) {
      socket.emit(EVENTS.ROOM_ERROR, { message: 'You need a pair to reinforce' });
      return;
    }

    updateTrumpDeclaration(gameId, suit, player.player_id, 2);
    singleDeclarerState.delete(gameId);

    const reinforcerBecomesKing = game.king_from_declaration === 1;
    if (reinforcerBecomesKing) {
      updateRoundKing(gameId, player.player_id);
    }

    io.to(game.room_id).emit(EVENTS.TRUMP_DECLARED, {
      trumpSuit: suit,
      declarerId: player.player_id,
      isPair: true,
      roundKingId: reinforcerBecomesKing ? player.player_id : game.round_king,
    });
  });

  socket.on(EVENTS.PICK_UP_KITTY, (payload: { gameId: string }) => {
    const { gameId } = payload;

    const game = getGame(gameId);
    if (!game) {
      socket.emit(EVENTS.ROOM_ERROR, { message: 'Game not found' });
      return;
    }

    if (trickStates.has(gameId)) {
      socket.emit(EVENTS.ROOM_ERROR, { message: 'Cannot pick up kitty after tricks have started' });
      return;
    }

    const player = getPlayerBySocketId(socket.id);
    if (!player || player.player_id !== game.round_king) {
      socket.emit(EVENTS.ROOM_ERROR, { message: 'Only the round king can pick up the kitty' });
      return;
    }

    const kittyCards: string[] = JSON.parse(game.kitty as string);

    updateGamePhase(gameId, 'kitty');
    singleDeclarerState.delete(gameId);
    updateKingFromDeclaration(gameId, false);
    socket.emit(EVENTS.KITTY_PICKED_UP, { kittyCards });
    socket.to(game.room_id).emit(EVENTS.KITTY_PICKED_UP, {});
  });

  socket.on(EVENTS.FINISH_KITTY, (payload: { gameId: string; kittyCards: string[]; handCards: string[] }) => {
    const { gameId, kittyCards, handCards } = payload;

    const game = getGame(gameId);
    if (!game) {
      socket.emit(EVENTS.ROOM_ERROR, { message: 'Game not found' });
      return;
    }

    const player = getPlayerBySocketId(socket.id);
    if (!player || player.player_id !== game.round_king) {
      socket.emit(EVENTS.ROOM_ERROR, { message: 'Only the round king can finish the kitty' });
      return;
    }

    const players = getPlayersInRoom(game.room_id).slice(0, MAX_PLAYERS);
    const expectedKittySize = getKittySize(players.length);
    if (kittyCards.length !== expectedKittySize) {
      socket.emit(EVENTS.ROOM_ERROR, { message: `Kitty must contain exactly ${expectedKittySize} cards` });
      return;
    }

    updateKitty(gameId, kittyCards);
    updatePlayerHand(player.player_id, handCards);

    updateGamePhase(gameId, 'trick');
    io.to(game.room_id).emit(EVENTS.KITTY_FINISHED, {});

    const kingIndex = players.findIndex(p => p.player_id === game.round_king);
    const playerOrder = players.map((_, i) => players[(kingIndex + i) % players.length].player_id);

    startTrick(io, gameId, game.room_id, game.round_king!, 1, playerOrder);
  });
}
