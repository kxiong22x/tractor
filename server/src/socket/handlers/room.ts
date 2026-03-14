import { Server, Socket } from 'socket.io';
import { EVENTS } from '../../../../shared/events';
import { getRoom, removeRoom } from '../../db/room.queries';
import { addPlayer, removePlayerBySocketId, getPlayersInRoom, getPlayerCountInRoom, getPlayerBySocketId, setPlayerDisconnected, setPlayerReconnected, getDisconnectedPlayerByName, updatePlayerRank } from '../../db/player.queries';
import { getGameByRoomId } from '../../db/game.queries';
import { JoinRoomPayload } from '../../types';
import { MAX_PLAYERS } from '../../game/constants';
import { trickStates, pendingNextTrick, pendingNextKing, dealingIntervals, dealingTicks, pendingRoundResults, singleDeclarerState } from '../state';
import { startDealing } from './game';
import { startTrick } from './trick';

export function registerRoomHandlers(io: Server, socket: Socket) {
  socket.on(EVENTS.JOIN_ROOM, (payload: JoinRoomPayload) => {
    const { roomId, displayName, startingRank } = payload;

    const room = getRoom(roomId);
    if (!room) {
      socket.emit(EVENTS.ROOM_ERROR, { message: 'Room not found' });
      return;
    }

    // Check if this is a reconnect during a frozen game (dealing or kitty phase)
    const game = getGameByRoomId(roomId);
    if (game) {
      const disconnectedPlayer = getDisconnectedPlayerByName(roomId, displayName);
      if (disconnectedPlayer) {
        const gameId = game.game_id;
        setPlayerReconnected(disconnectedPlayer.player_id, socket.id);
        socket.join(roomId);

        const myHand = JSON.parse(disconnectedPlayer.hand || '[]');
        const players = getPlayersInRoom(roomId).map(p => ({
          ...p,
          hand: p.player_id === disconnectedPlayer.player_id ? myHand : JSON.parse(p.hand || '[]'),
        }));
        const tickData = dealingTicks.get(gameId);
        const trickState = trickStates.get(gameId);
        const pntData = pendingNextTrick.get(gameId);

        if (tickData) {
          startDealing(io, gameId, roomId, tickData.total, tickData.current);
          socket.emit(EVENTS.REJOIN_SUCCESS, {
            players,
            game,
            myHand,
            phase: 'dealing',
            currentDealTick: tickData.current,
            totalDealTicks: tickData.total,
            trickState: null,
            pendingNextTrick: null,
          });
        } else if (trickState) {
          // TRICK PHASE RECONNECT
          if (pntData) {
            // Between-tricks: restart timer with shorter delay (1.5 s).
            // Gives client time to mount and attach listeners before trick-started fires.
            const handle = setTimeout(() => {
              pendingNextTrick.delete(gameId);
              startTrick(io, gameId, roomId, pntData.winnerId, pntData.nextTrickNum, pntData.rotatedOrder);
            }, 1500);
            pendingNextTrick.set(gameId, { ...pntData, handle });
          }

          socket.emit(EVENTS.REJOIN_SUCCESS, {
            players,
            game,
            myHand,
            phase: 'trick',
            currentDealTick: 0,
            totalDealTicks: 0,
            trickState: {
              trickNum: trickState.trickNum,
              leaderId: trickState.leaderId,
              currentTurn: trickState.currentTurn,
              playerOrder: trickState.playerOrder,
              plays: [...trickState.plays.entries()],
              committed: [...trickState.committed],
              leaderShape: trickState.leaderShape,
            },
            pendingNextTrick: null,
          });
        } else {
          const roundResult = pendingRoundResults.get(gameId);
          const kittyCards = game.phase === 'kitty' && disconnectedPlayer.player_id === game.round_king
            ? JSON.parse(game.kitty as string)
            : undefined;
          const singleDeclarer = singleDeclarerState.get(gameId) ?? null;
          socket.emit(EVENTS.REJOIN_SUCCESS, {
            players,
            game,
            myHand,
            phase: roundResult ? 'round-over' : game.phase,
            kittyCards,
            roundResult,
            currentDealTick: 0,
            totalDealTicks: 0,
            trickState: null,
            pendingNextTrick: null,
            singleDeclarer,
          });
          if (singleDeclarer && singleDeclarer.playerId === disconnectedPlayer.player_id && game.trump_declarer !== disconnectedPlayer.player_id) {
            socket.emit(EVENTS.CAN_REINFORCE, { targetPlayerId: singleDeclarer.playerId, card: singleDeclarer.card });
          }
        }

        io.to(roomId).emit(EVENTS.PLAYER_RECONNECTED, {
          playerId: disconnectedPlayer.player_id,
          players,
        });
        return;
      }
    }

    const count = getPlayerCountInRoom(roomId);
    if (count >= MAX_PLAYERS) {
      socket.emit(EVENTS.ROOM_ERROR, { message: 'Room is full (max 6 players)' });
      return;
    }

    const existingPlayers = getPlayersInRoom(roomId);
    if (existingPlayers.some(p => p.display_name === displayName)) {
      socket.emit(EVENTS.ROOM_ERROR, { message: 'That name is already taken in this room' });
      return;
    }

    const player = addPlayer(roomId, displayName, socket.id, startingRank);
    socket.join(roomId);

    const players = getPlayersInRoom(roomId);
    io.to(roomId).emit(EVENTS.PLAYER_JOINED, { player, players });
  });

  socket.on(EVENTS.SET_STARTING_RANK, (payload: { roomId: string; rank: number }) => {
    const player = getPlayerBySocketId(socket.id);
    if (!player) return;
    const rank = Math.max(2, Math.min(14, Math.round(payload.rank)));
    updatePlayerRank(player.player_id, rank);
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
    io.to(roomId).emit(EVENTS.PLAYER_LEFT, { playerId: player.player_id, players });
    socket.leave(roomId);
    return;
  }

  // Always freeze the player and notify the room
  setPlayerDisconnected(socket.id);
  io.to(roomId).emit(EVENTS.PLAYER_DISCONNECTED, {
    playerId: player.player_id,
    playerName: player.display_name,
  });

  // Phase-specific timer cleanup
  const gameId = game.game_id;
  if (dealingIntervals.has(gameId)) {
    clearInterval(dealingIntervals.get(gameId)!);
    dealingIntervals.delete(gameId);
  } else if (trickStates.has(gameId)) {
    const pnt = pendingNextTrick.get(gameId);
    if (pnt) clearTimeout(pnt.handle);
    // Entry is intentionally left in pendingNextTrick — its presence tells
    // the reconnect handler to restart the timer.
  }
  // Other phases need no timer cleanup
}
