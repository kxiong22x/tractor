import { Server, Socket } from 'socket.io';
import { getRoom, removeRoom } from '../../room.queries';
import { addPlayer, removePlayerBySocketId, getPlayersInRoom, getPlayerCountInRoom, getPlayerBySocketId, removePlayer, setPlayerDisconnected, setPlayerReconnected, getDisconnectedPlayerByName } from '../../player.queries';
import { getGameByRoomId } from '../../game.queries';
import { JoinRoomPayload } from '../../types';
import { MAX_PLAYERS } from '../../constants';
import { trickStates, pendingNextTrick, pendingNextKing, dealingIntervals, frozenGames, dealingTicks, kittyPickedUpGames, pendingRoundResults } from '../state';
import { startDealing } from './game';
import { startTrick } from './trick';

export function registerRoomHandlers(io: Server, socket: Socket) {
  socket.on('join-room', (payload: JoinRoomPayload) => {
    const { roomId, displayName } = payload;

    const room = getRoom(roomId);
    if (!room) {
      socket.emit('room-error', { message: 'Room not found' });
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
        frozenGames.delete(gameId);

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
          socket.emit('rejoin-success', {
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

          socket.emit('rejoin-success', {
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
          const isKittyPhase = kittyPickedUpGames.has(gameId);
          const kittyCards = isKittyPhase && disconnectedPlayer.player_id === game.round_king
            ? JSON.parse(game.kitty as string)
            : undefined;
          socket.emit('rejoin-success', {
            players,
            game,
            myHand,
            phase: roundResult ? 'round-over' : isKittyPhase ? 'kitty' : 'declaration',
            kittyCards,
            roundResult,
            currentDealTick: 0,
            totalDealTicks: 0,
            trickState: null,
            pendingNextTrick: null,
          });
        }

        io.to(roomId).emit('player-reconnected', {
          playerId: disconnectedPlayer.player_id,
          players,
        });
        return;
      }
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

  const gameId = game.game_id;

  if (dealingIntervals.has(gameId)) {
    // DEALING PHASE freeze 
    setPlayerDisconnected(socket.id);
    clearInterval(dealingIntervals.get(gameId)!);
    dealingIntervals.delete(gameId);
    frozenGames.set(gameId, player.player_id);
    io.to(roomId).emit('player-disconnected', {
      playerId: player.player_id,
      playerName: player.display_name,
    });
  } else if (!trickStates.has(gameId) && game.trump_suit !== 'NA') {
    // KITTY PHASE freeze
    setPlayerDisconnected(socket.id);
    frozenGames.set(gameId, player.player_id);
    io.to(roomId).emit('player-disconnected', {
      playerId: player.player_id,
      playerName: player.display_name,
    });
  } else if (trickStates.has(gameId)) {
    // TRICK PHASE freeze
    setPlayerDisconnected(socket.id);

    // Pause between-tricks timer if running.
    // Keep the pendingNextTrick entry as the reconnect signal (same pattern as
    // dealingIntervals cleared / dealingTicks kept during dealing freeze).
    const pnt = pendingNextTrick.get(gameId);
    if (pnt) {
      clearTimeout(pnt.handle);
      // Entry is intentionally left in pendingNextTrick — its presence tells
      // the reconnect handler to restart the timer.
    }

    frozenGames.set(gameId, player.player_id);
    io.to(roomId).emit('player-disconnected', {
      playerId: player.player_id,
      playerName: player.display_name,
    });
  } else {
    setPlayerDisconnected(socket.id);
    frozenGames.set(gameId, player.player_id);
    io.to(roomId).emit('player-disconnected', {
      playerId: player.player_id,
      playerName: player.display_name,
    });
  }
}
