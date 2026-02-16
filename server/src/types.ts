export interface Room {
  room_id: string;
  url: string;
  creation_time: string;
}

export interface Player {
  player_id: string;
  display_name: string;
  room_id: string;
  socket_id: string | null;
  hand: string | null;
  rank: number;
  joined_at: string;
}

export interface JoinRoomPayload {
  roomId: string;
  displayName: string;
}

export interface PlayerJoinedEvent {
  player: Player;
  players: Player[];
}

export interface PlayerLeftEvent {
  playerId: string;
  players: Player[];
}

export interface RoomErrorEvent {
  message: string;
}

export interface Game {
  game_id: string;
  room_id: string;
  kitty: string;
  round_king: string | null;
  trump_number: string;
  trump_suit: string;
  trump_declarer: string | null;
  trump_count: number;
  created_at: string;
}

export interface DeclareTrumpPayload {
  gameId: string;
  card: string;
}

export interface TrumpDeclaredEvent {
  trumpSuit: string;
  declarerId: string;
  isPair: boolean;
  roundKingId: string;
}
