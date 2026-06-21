import type { Player } from './types';

export interface RoomState {
  joined: boolean;
  players: Player[];
  error: string | null;
}

export type RoomAction =
  | { type: 'PLAYERS_LOADED'; players: Player[] }
  | { type: 'LOAD_ERROR'; message: string }
  | { type: 'JOINED' }
  | { type: 'PLAYER_JOINED'; players: Player[] }
  | { type: 'PLAYER_LEFT'; players: Player[] }
  | { type: 'ROOM_ERROR'; message: string };

export const initialRoomState: RoomState = {
  joined: false,
  players: [],
  error: null,
};

export function roomReducer(state: RoomState, action: RoomAction): RoomState {
  switch (action.type) {
    case 'PLAYERS_LOADED':
      return { ...state, players: action.players };
    case 'LOAD_ERROR':
      return { ...state, error: action.message };
    case 'JOINED':
      return { ...state, joined: true, error: null };
    case 'PLAYER_JOINED':
      return { ...state, players: action.players };
    case 'PLAYER_LEFT':
      return { ...state, players: action.players };
    case 'ROOM_ERROR':
      return { ...state, error: action.message };
    default:
      return state;
  }
}
