import { useEffect, type Dispatch } from 'react';
import { API_BASE_URL } from '../config';
import { mapPlayer, type RawPlayer } from '../types';
import type { RoomAction } from '../pages/RoomPage/roomState';

// Fetches the initial player list for a room via HTTP and dispatches it into room state.
// Used by RoomPage on mount so the lobby shows players already present before any socket events arrive.
export function useRoomData(roomId: string | undefined, dispatch: Dispatch<RoomAction>) {
  useEffect(() => {
    fetch(`${API_BASE_URL}/api/rooms/${roomId}`)
      .then((res) => {
        if (!res.ok) throw new Error('Room not found');
        return res.json();
      })
      .then((data) => dispatch({ type: 'PLAYERS_LOADED', players: (data.players as RawPlayer[]).map(mapPlayer) }))
      .catch(() => dispatch({ type: 'LOAD_ERROR', message: 'Room not found' }));
  }, [roomId]);
}
