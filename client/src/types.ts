// Raw server-side player shape (snake_case, mirrors database columns).
// Used only at socket/fetch boundaries before mapping to the client type.
export interface RawPlayer {
  player_id: string;
  display_name: string;
  room_id: string;
  socket_id: string | null;
  rank: number;
  round_points: number;
  joined_at: string;
}

// Client-side player (camelCase).
export interface Player {
  playerId: string;
  displayName: string;
  roomId: string;
  socketId: string | null;
  rank: number;
  roundPoints: number;
  joinedAt: string;
}

export function mapPlayer(raw: RawPlayer): Player {
  return {
    playerId: raw.player_id,
    displayName: raw.display_name,
    roomId: raw.room_id,
    socketId: raw.socket_id,
    rank: raw.rank,
    roundPoints: raw.round_points,
    joinedAt: raw.joined_at,
  };
}

export function mapGamePlayer(raw: RawPlayer & { hand: string[] }): Player & { hand: string[] } {
  return { ...mapPlayer(raw), hand: raw.hand };
}
