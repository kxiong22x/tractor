import { useEffect, type Dispatch } from 'react';
import { EVENTS } from '../../../shared/events';
import type { NavigateFunction } from 'react-router-dom';
import type { Socket } from 'socket.io-client';
import { mapPlayer, mapGamePlayer, type RawPlayer } from '../types';
import type { RoomAction } from '../pages/RoomPage/roomState';

interface UseRoomSocketParams {
  socket: Socket;
  roomId: string | undefined;
  dispatch: Dispatch<RoomAction>;
  navigate: NavigateFunction;
}

export function useRoomSocket({ socket, roomId, dispatch, navigate }: UseRoomSocketParams) {
  useEffect(() => {
    const onPlayerJoined = (data: { player: RawPlayer; players: RawPlayer[] }) => {
      dispatch({ type: 'PLAYER_JOINED', players: data.players.map(mapPlayer) });
    };

    const onPlayerLeft = (data: { playerId: string; players: RawPlayer[] }) => {
      dispatch({ type: 'PLAYER_LEFT', players: data.players.map(mapPlayer) });
    };

    const onRoomError = (data: { message: string }) => {
      dispatch({ type: 'ROOM_ERROR', message: data.message });
    };

    const onGameStarted = (data: { gameId: string; players: Array<RawPlayer & { hand: string[] }>; trumpNumber: string; trumpSuit: string; roundKingId: string | null }) => {
      console.log('game-started received:', data);
      navigate(`/room/${roomId}/game`, {
        state: { gameId: data.gameId, players: data.players.map(mapGamePlayer), trumpNumber: data.trumpNumber, trumpSuit: data.trumpSuit, roundKingId: data.roundKingId },
      });
    };

    const onRejoinSuccess = (data: {
      game: { game_id: string; trump_number: string; trump_suit: string; round_king: string | null; trump_declarer: string | null; trump_count: number };
      players: Array<RawPlayer & { hand: string[] }>;
      currentDealTick: number;
      phase: string;
      kittyCards?: string[];
      singleDeclarer?: { playerId: string; card: string } | null;
      roundResult?: {
        attackingPoints: number;
        defendingPoints: number;
        rankChanges: Record<string, { oldRank: number; newRank: number }>;
        nextKingId: string;
        winningTeam: 'attacking' | 'defending';
        kittyBonus: number;
        gameOver: boolean;
      };
      trickState: {
        trickNum: number;
        leaderId: string;
        currentTurn: string;
        playerOrder: string[];
        plays: [string, string[]][];
        committed: string[];
        leaderShape: unknown | null;
      } | null;
    }) => {
      navigate(`/room/${roomId}/game`, {
        state: {
          gameId: data.game.game_id,
          players: data.players.map(mapGamePlayer),
          trumpNumber: data.game.trump_number,
          trumpSuit: data.game.trump_suit,
          roundKingId: data.game.round_king,
          trumpDeclarerId: data.game.trump_declarer,
          trumpIsPair: data.game.trump_count >= 2,
          initialDealTick: data.currentDealTick,
          phase: data.phase,
          kittyCards: data.kittyCards ?? null,
          roundResult: data.roundResult ?? null,
          trickState: data.trickState ?? null,
          singleDeclarer: data.singleDeclarer ?? null,
        },
      });
    };

    const handlers: [string, (...args: any[]) => void][] = [
      [EVENTS.PLAYER_JOINED, onPlayerJoined],
      [EVENTS.PLAYER_LEFT, onPlayerLeft],
      [EVENTS.ROOM_ERROR, onRoomError],
      [EVENTS.GAME_STARTED, onGameStarted],
      [EVENTS.REJOIN_SUCCESS, onRejoinSuccess],
    ];
    for (const [event, handler] of handlers) socket.on(event, handler);
    return () => { for (const [event, handler] of handlers) socket.off(event, handler); };
  }, [socket]);
}
