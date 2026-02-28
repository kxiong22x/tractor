import { Server, Socket } from 'socket.io';
import { getRoom, removeRoom } from '../../room.queries';
import { addPlayer, removePlayerBySocketId, getPlayersInRoom, getPlayerCountInRoom, getPlayerBySocketId, removePlayer } from '../../player.queries';
import { getGameByRoomId } from '../../game.queries';
import { JoinRoomPayload } from '../../types';
import { MAX_PLAYERS } from '../../constants';
import { trickStates, pendingNextTrick, pendingNextKing, dealingIntervals } from '../state';

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
    // Lobby disconnect: remove immediately
    removePlayerBySocketId(socket.id);
    const players = getPlayersInRoom(roomId);
    if (players.length === 0) {
      removeRoom(roomId);
    }
    io.to(roomId).emit('player-left', { playerId: player.player_id, players });
    socket.leave(roomId);
    return;
  }

  // In-game disconnect: immediately abandon the game
  removePlayer(player.player_id);

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

  io.to(roomId).emit('game-abandoned', { reason: 'Player disconnected' });
}
