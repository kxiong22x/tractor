import { Server, Socket } from 'socket.io';
import { getPlayersInRoom, resetRoundPoints, getPlayerRank, updatePlayerHand } from '../../player.queries';
import { createGame, getGame, updateKitty, resetGameForNewRound } from '../../game.queries';
import { dealCards } from '../../deck';
import { MAX_PLAYERS, MIN_PLAYERS_TO_START } from '../../constants';
import { dealingIntervals, pendingNextKing } from '../state';
import { startTrick } from './trick';

export function startDealing(io: Server, gameId: string, roomId: string, totalTicks: number) {
  if (dealingIntervals.has(gameId)) {
    clearInterval(dealingIntervals.get(gameId)!);
  }
  let tick = 0;
  const interval = setInterval(() => {
    tick++;
    io.to(roomId).emit('deal-tick', { tick });
    if (tick >= totalTicks) {
      clearInterval(interval);
      dealingIntervals.delete(gameId);
      io.to(roomId).emit('dealing-complete');
    }
  }, 500);
  dealingIntervals.set(gameId, interval);
}

export function registerGameHandlers(io: Server, socket: Socket) {
  socket.on('start-game', (payload: { roomId: string }) => {
    const { roomId } = payload;
    const players = getPlayersInRoom(roomId);
    if (players.length < MIN_PLAYERS_TO_START) {
      socket.emit('room-error', { message: `Need at least ${MIN_PLAYERS_TO_START} players to start` });
      return;
    }

    const gamePlayers = players.slice(0, MAX_PLAYERS);

    resetRoundPoints(roomId);

    const trumpNumber = String(getPlayerRank(gamePlayers[0].player_id));

    const { hands, kitty } = dealCards(gamePlayers.length);

    const game = createGame(roomId, kitty, null, trumpNumber);
    for (let i = 0; i < gamePlayers.length; i++) {
      updatePlayerHand(gamePlayers[i].player_id, hands[i]);
    }

    const playersWithHands = gamePlayers.map((p, i) => ({
      ...p,
      hand: hands[i],
    }));

    io.to(roomId).emit('game-started', {
      gameId: game.game_id,
      players: playersWithHands,
      trumpNumber,
      trumpSuit: 'NA',
      roundKingId: null,
      kittySize: kitty.length,
    });

    startDealing(io, game.game_id, roomId, hands[0].length * gamePlayers.length);
  });

  socket.on('start-next-round', (payload: { gameId: string }) => {
    const { gameId } = payload;

    const game = getGame(gameId);
    if (!game) {
      socket.emit('room-error', { message: 'Game not found' });
      return;
    }

    const nextKingId = pendingNextKing.get(gameId);
    if (!nextKingId) {
      socket.emit('room-error', { message: 'No pending next round' });
      return;
    }
    pendingNextKing.delete(gameId);

    resetRoundPoints(game.room_id);

    const nextKingRank = getPlayerRank(nextKingId);
    const trumpNumber = String(nextKingRank);

    resetGameForNewRound(gameId, trumpNumber, nextKingId);

    const gamePlayers = getPlayersInRoom(game.room_id).slice(0, MAX_PLAYERS);
    const { hands, kitty } = dealCards(gamePlayers.length);

    updateKitty(gameId, kitty);

    for (let i = 0; i < gamePlayers.length; i++) {
      updatePlayerHand(gamePlayers[i].player_id, hands[i]);
    }

    const playersWithHands = gamePlayers.map((p, i) => ({
      ...p,
      hand: hands[i],
      rank: p.rank,
    }));

    const updatedGame = getGame(gameId)!;

    io.to(game.room_id).emit('game-started', {
      gameId: game.game_id,
      players: playersWithHands,
      trumpNumber,
      trumpSuit: 'NA',
      roundKingId: nextKingId,
      roundNumber: updatedGame.round_number,
      kittySize: kitty.length,
    });

    startDealing(io, game.game_id, game.room_id, hands[0].length * gamePlayers.length);
  });
}
