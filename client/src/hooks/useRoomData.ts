import { useEffect, type Dispatch } from 'react';
import { API_BASE_URL } from '../config';
import { mapPlayer, type RawPlayer } from '../types';
import type { RoomAction } from '../pages/RoomPage/roomState';

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
