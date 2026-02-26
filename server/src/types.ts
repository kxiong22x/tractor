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
  round_points: number;
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
  round_number: number;
  created_at: string;
}

export interface DeclareTrumpPayload {
  gameId: string;
  card: string;
  wantPair?: boolean;
}

export interface TrumpDeclaredEvent {
  trumpSuit: string;
  declarerId: string;
  isPair: boolean;
  roundKingId: string;
}

export interface PlayCardsPayload {
  gameId: string;
  cards: string[];
}

export interface TrumpContext {
  trumpSuit: string;
  trumpNumber: string;
}

export interface PlayShape {
  type: 'single' | 'pair' | 'tractor' | 'throw' | 'invalid';
  tractorLength?: number;
  suit: string;
  components?: PlayShape[];
}

export interface TrickState {
  gameId: string;
  roomId: string;
  trickNum: number;
  leaderId: string;
  currentTurn: string;
  playerOrder: string[];
  plays: Map<string, string[]>;
  committed: Set<string>;
  leaderShape: { type: 'single' | 'pair' | 'tractor' | 'throw'; tractorLength?: number; suit: string; components?: { type: 'single' | 'pair' | 'tractor'; tractorLength?: number; suit: string }[] } | null;
}

export interface RejoinSuccessPayload {
  players: Player[];
  game: Game;
  myHand: string[];
  phase: 'dealing' | 'declaration' | 'kitty' | 'trick' | 'round-over';
  trickState: {
    trickNum: number;
    leaderId: string;
    currentTurn: string;
    playerOrder: string[];
    plays: [string, string[]][];
    committed: string[];
    leaderShape: PlayShape | null;
  } | null;
  pendingNextTrick: {
    winnerId: string;
    trickPoints: number;
    nextTrickNum: number;
    rotatedOrder: string[];
  } | null;
}
