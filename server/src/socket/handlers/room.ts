import { Server, Socket } from 'socket.io';
import { getRoom, removeRoom } from '../../room.queries';
import { addPlayer, removePlayerBySocketId, getPlayersInRoom, getPlayerCountInRoom, setPlayerDisconnected, setPlayerReconnected, getPlayerById, getPlayerBySocketId, removePlayer } from '../../player.queries';
import { getGameByRoomId } from '../../game.queries';
import { JoinRoomPayload } from '../../types';
import { MAX_PLAYERS } from '../../constants';
import { trickStates, pendingNextTrick, pendingNextKing, dealingIntervals, disconnectedPlayers, reconnectTimeouts } from '../state';
import { parseHand } from '../../deck';

const RECONNECT_TIMEOUT_MS = 300_000;

export function registerRoomHandlers(io: Server, socket: Socket) {
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

    const existingPlayers = getPlayersInRoom(roomId);
    if (existingPlayers.some(p => p.display_name === displayName)) {
      socket.emit('room-error', { message: 'That name is already taken in this room' });
      return;
    }

    const player = addPlayer(roomId, displayName, socket.id);
    socket.join(roomId);

    const players = getPlayersInRoom(roomId);
    io.to(roomId).emit('player-joined', { player, players });
  });

  socket.on('rejoin-game', (payload: { playerId: string }) => {
    const { playerId } = payload;

    const player = getPlayerById(playerId);
    if (!player) {
      socket.emit('room-error', { message: 'Player not found — game may have ended' });
      return;
    }

    const roomId = player.room_id;

    // Cancel pending timeout
    const existing = reconnectTimeouts.get(playerId);
    if (existing) {
      clearTimeout(existing);
      reconnectTimeouts.delete(playerId);
    }

    // Update socket in DB
    setPlayerReconnected(playerId, socket.id);

    // Remove from disconnected set
    const dcSet = disconnectedPlayers.get(roomId);
    if (dcSet) {
      dcSet.delete(playerId);
      if (dcSet.size === 0) disconnectedPlayers.delete(roomId);
    }

    socket.join(roomId);

    // Build snapshot
    const game = getGameByRoomId(roomId);
    if (!game) {
      socket.emit('room-error', { message: 'No active game found' });
      return;
    }

    const players = getPlayersInRoom(roomId);
    const dbPlayer = getPlayerById(playerId);
    const myHand = dbPlayer ? parseHand(dbPlayer) : [];

    // Determine phase
    let phase: 'dealing' | 'declaration' | 'kitty' | 'trick' | 'round-over';
    const gameId = game.game_id;
    if (dealingIntervals.has(gameId)) {
      phase = 'dealing';
    } else if (trickStates.has(gameId) || pendingNextTrick.has(gameId)) {
      phase = 'trick';
    } else if (pendingNextKing.has(gameId)) {
      phase = 'round-over';
    } else if (game.trump_suit !== 'NA') {
      phase = 'kitty';
    } else {
      phase = 'declaration';
    }

    // Serialize trick state
    const ts = trickStates.get(gameId);
    const trickStatePayload = ts ? {
      trickNum: ts.trickNum,
      leaderId: ts.leaderId,
      currentTurn: ts.currentTurn,
      playerOrder: ts.playerOrder,
      plays: Array.from(ts.plays.entries()) as [string, string[]][],
      committed: Array.from(ts.committed),
      leaderShape: ts.leaderShape,
    } : null;

    // Serialize pending next trick
    const pnt = pendingNextTrick.get(gameId);
    const pendingNextTrickPayload = pnt ? {
      winnerId: pnt.winnerId,
      trickPoints: pnt.trickPoints,
      nextTrickNum: pnt.nextTrickNum,
      rotatedOrder: pnt.rotatedOrder,
    } : null;

    socket.emit('rejoin-success', {
      players,
      game,
      myHand,
      phase,
      trickState: trickStatePayload,
      pendingNextTrick: pendingNextTrickPayload,
    });

    const updatedPlayers = getPlayersInRoom(roomId);
    socket.to(roomId).emit('player-reconnected', { playerId, players: updatedPlayers });
  });

  socket.on('disconnect', () => {
    console.log(`Socket disconnected: ${socket.id}`);
    handleDisconnect(io, socket);
  });
}

function handleDisconnect(io: Server, socket: Socket) {
  const player = getPlayerBySocketId(socket.id);

  if (!player) return;

  const roomId = player.room_id;
  const game = getGameByRoomId(roomId);

  if (!game) {
    // Lobby disconnect: remove immediately as before
    removePlayerBySocketId(socket.id);
    const players = getPlayersInRoom(roomId);
    if (players.length === 0) {
      removeRoom(roomId);
    }
    io.to(roomId).emit('player-left', { playerId: player.player_id, players });
    socket.leave(roomId);
    return;
  }

  // In-game disconnect: freeze and wait for reconnect
  setPlayerDisconnected(socket.id);

  if (!disconnectedPlayers.has(roomId)) {
    disconnectedPlayers.set(roomId, new Set());
  }
  disconnectedPlayers.get(roomId)!.add(player.player_id);

  const updatedPlayers = getPlayersInRoom(roomId);
  io.to(roomId).emit('player-disconnected', { playerId: player.player_id, players: updatedPlayers });

  const timeout = setTimeout(() => {
    reconnectTimeouts.delete(player.player_id);

    // Remove player from DB
    removePlayer(player.player_id);

    // Remove from disconnected set
    const dcSet = disconnectedPlayers.get(roomId);
    if (dcSet) {
      dcSet.delete(player.player_id);
      if (dcSet.size === 0) disconnectedPlayers.delete(roomId);
    }

    // Clean up in-memory game state
    const gameId = game.game_id;
    const dealInterval = dealingIntervals.get(gameId);
    if (dealInterval) {
      clearInterval(dealInterval);
      dealingIntervals.delete(gameId);
    }
    const pnt = pendingNextTrick.get(gameId);
    if (pnt) {
      clearTimeout(pnt.handle);
      pendingNextTrick.delete(gameId);
    }
    trickStates.delete(gameId);
    pendingNextKing.delete(gameId);

    io.to(roomId).emit('game-abandoned', { reason: 'Player timed out' });
  }, RECONNECT_TIMEOUT_MS);

  reconnectTimeouts.set(player.player_id, timeout);
}
