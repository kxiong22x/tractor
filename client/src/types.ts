export interface Player {
  player_id: string;
  display_name: string;
  room_id: string;
  socket_id: string | null;
  rank: number;
  joined_at: string;
}

export interface Room {
  room_id: string;
  url: string;
  creation_time: string;
}