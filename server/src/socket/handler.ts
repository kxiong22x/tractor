import { Server, Socket } from 'socket.io';
import { getRoom } from '../room/room.queries';
import { addPlayer, removePlayerBySocketId, getPlayersInRoom, getPlayerCountInRoom, getPlayerBySocketId, getPlayerRank } from '../player/player.queries';
import { createGame, updatePlayerHand, getGame, updateTrumpDeclaration, updateRoundKing, updateKitty } from '../game/game.queries';
import { createDeck, shuffleDeck } from '../game/deck';
import { JoinRoomPayload, DeclareTrumpPayload } from '../types';

const MAX_PLAYERS = 6;
const MIN_PLAYERS_TO_START = 4;
const CARDS_PER_PLAYER = 25;
const KITTY_SIZE = 8;

function parseCard(card: string): { suit: string; rank: string } {
  const [cardPart] = card.split('-');
  return { suit: cardPart[0], rank: cardPart.slice(1) };
}

export function registerSocketHandlers(io: Server) {
  io.on('connection', (socket: Socket) => {
    console.log(`Socket connected: ${socket.id}`);

    socket.on('join-room', (payload: JoinRoomPayload) => {
      const { roomId, displayName } = payload;

      const room = getRoom(roomId);
      if (!room) {
        socket.emit('room-error', { message: 'Room not found' });
        return;
      }

      const count = getPlayerCountInRoom(roomId);
      if (count >= MAX_PLAYERS) {
        socket.emit('room-error', { message: 'Room is full (max 6 players)' });
        return;
      }

      const player = addPlayer(roomId, displayName, socket.id);
      socket.join(roomId);

      const players = getPlayersInRoom(roomId);
      io.to(roomId).emit('player-joined', { player, players });
    });

    socket.on('start-game', (payload: { roomId: string }) => {
      const { roomId } = payload;
      const players = getPlayersInRoom(roomId);
      if (players.length < MIN_PLAYERS_TO_START) {
        socket.emit('room-error', { message: `Need at least ${MIN_PLAYERS_TO_START} players to start` });
        return;
      }

      // Use first 4 players by join order
      const gamePlayers = players.slice(0, 4);

      // Round king starts as null — set when trump is declared
      const trumpNumber = String(getPlayerRank(gamePlayers[0].player_id));

      // Create and shuffle deck
      const deck = shuffleDeck(createDeck());

      // Deal cards round-robin: 25 to each player, 8 to kitty
      const hands: string[][] = [[], [], [], []];

      for (let i = 0; i < CARDS_PER_PLAYER * 4; i++) {
        hands[i % 4].push(deck[i]);
      }

      const kitty = deck.slice(CARDS_PER_PLAYER * 4, CARDS_PER_PLAYER * 4 + KITTY_SIZE);

      // Store in DB
      const game = createGame(roomId, kitty, null, trumpNumber);
      for (let i = 0; i < 4; i++) {
        updatePlayerHand(gamePlayers[i].player_id, hands[i]);
      }

      // Attach hands to player objects so each client can find their own
      const playersWithHands = gamePlayers.map((p, i) => ({
        ...p,
        hand: hands[i],
      }));

      // Single event with everything the client needs
      io.to(roomId).emit('game-started', {
        gameId: game.game_id,
        players: playersWithHands,
        trumpNumber,
        trumpSuit: 'NA',
        roundKingId: null,
      });
    });

    socket.on('declare-trump', (payload: DeclareTrumpPayload) => {
      const { gameId, card } = payload;

      const game = getGame(gameId);
      if (!game) {
        socket.emit('room-error', { message: 'Game not found' });
        return;
      }

      // Declaration is final once a pair has been declared
      if (game.trump_count >= 2) {
        socket.emit('room-error', { message: 'Trump declaration is already final' });
        return;
      }

      const player = getPlayerBySocketId(socket.id);
      if (!player) {
        socket.emit('room-error', { message: 'Player not found' });
        return;
      }

      const { suit, rank } = parseCard(card);

      // Card rank must match trump number
      if (rank !== game.trump_number) {
        socket.emit('room-error', { message: 'Card rank does not match trump number' });
        return;
      }

      // Get player's hand to validate they have the card(s)
      const hand: string[] = player.hand ? JSON.parse(player.hand as unknown as string) : [];
      const matchingCards = hand.filter((c) => {
        const parsed = parseCard(c);
        return parsed.suit === suit && parsed.rank === rank;
      });

      if (matchingCards.length === 0) {
        socket.emit('room-error', { message: 'You do not have this card' });
        return;
      }

      if (game.trump_count === 0) {
        // No declaration yet — anyone can declare with a single card
        updateTrumpDeclaration(gameId, suit, player.player_id, 1);
        updateRoundKing(gameId, player.player_id);
        io.to(game.room_id).emit('trump-declared', {
          trumpSuit: suit,
          declarerId: player.player_id,
          isPair: false,
          roundKingId: player.player_id,
        });
      } else if (game.trump_count === 1) {
        // Single declaration exists
        if (player.player_id === game.trump_declarer && suit === game.trump_suit) {
          // Reinforcement: original declarer adds second card of same suit
          if (matchingCards.length >= 2) {
            updateTrumpDeclaration(gameId, suit, player.player_id, 2);
            updateRoundKing(gameId, player.player_id);
            io.to(game.room_id).emit('trump-declared', {
              trumpSuit: suit,
              declarerId: player.player_id,
              isPair: true,
              roundKingId: player.player_id,
            });
          } else {
            socket.emit('room-error', { message: 'You need a pair to reinforce' });
          }
        } else {
          // Override: different player or different suit — needs a pair
          if (matchingCards.length >= 2) {
            updateTrumpDeclaration(gameId, suit, player.player_id, 2);
            updateRoundKing(gameId, player.player_id);
            io.to(game.room_id).emit('trump-declared', {
              trumpSuit: suit,
              declarerId: player.player_id,
              isPair: true,
              roundKingId: player.player_id,
            });
          } else {
            socket.emit('room-error', { message: 'You need a pair to override the current declaration' });
          }
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

      const player = getPlayerBySocketId(socket.id);
      if (!player || player.player_id !== game.round_king) {
        socket.emit('room-error', { message: 'Only the round king can pick up the kitty' });
        return;
      }

      const kittyCards: string[] = JSON.parse(game.kitty as string);

      // Send kitty cards only to the round king
      socket.emit('kitty-picked-up', { kittyCards });
      // Notify other players (no cards)
      socket.to(game.room_id).emit('kitty-picked-up', {});
    });

    socket.on('finish-kitty', (payload: { gameId: string; kittyCards: string[]; handCards: string[] }) => {
      const { gameId, kittyCards, handCards } = payload;

      const game = getGame(gameId);
      if (!game) {
        socket.emit('room-error', { message: 'Game not found' });
        return;
      }

      const player = getPlayerBySocketId(socket.id);
      if (!player || player.player_id !== game.round_king) {
        socket.emit('room-error', { message: 'Only the round king can finish the kitty' });
        return;
      }

      if (kittyCards.length !== 8) {
        socket.emit('room-error', { message: 'Kitty must contain exactly 8 cards' });
        return;
      }

      updateKitty(gameId, kittyCards);
      updatePlayerHand(player.player_id, handCards);

      io.to(game.room_id).emit('kitty-finished', {});
    });

    socket.on('leave-room', () => {
      handleDisconnect(io, socket);
    });

    socket.on('disconnect', () => {
      console.log(`Socket disconnected: ${socket.id}`);
      handleDisconnect(io, socket);
    });
  });
}

function handleDisconnect(io: Server, socket: Socket) {
  const player = removePlayerBySocketId(socket.id);
  if (player) {
    const players = getPlayersInRoom(player.room_id);
    io.to(player.room_id).emit('player-left', { playerId: player.player_id, players });
    socket.leave(player.room_id);
  }
}
