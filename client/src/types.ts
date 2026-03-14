export interface Player {
  player_id: string;
  display_name: string;
  room_id: string;
  socket_id: string | null;
  rank: number;
  round_points: number;
  joined_at: string;
}
