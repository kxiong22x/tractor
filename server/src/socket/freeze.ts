import { disconnectedPlayers } from './state';

export function isRoomFrozen(roomId: string): boolean {
  return (disconnectedPlayers.get(roomId)?.size ?? 0) > 0;
}
