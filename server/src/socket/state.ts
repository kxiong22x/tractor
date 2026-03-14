import { TrickState } from '../types';

// gameId → setInterval handle for deal-tick animation; held so it can be cancelled on disconnect
export const dealingIntervals = new Map<string, ReturnType<typeof setInterval>>();

// gameId → deal progress; kept so a reconnecting player can resume the animation mid-deal
export const dealingTicks = new Map<string, { current: number; total: number }>();

// gameId → single trump declarer info; enables override/reinforce window, cleared when window closes
export const singleDeclarerState = new Map<string, { playerId: string; card: string }>();

// gameId → live trick state; present only while a trick is in progress
export const trickStates = new Map<string, TrickState>();

// gameId → pending between-trick transition; setTimeout is paused if a player disconnects
export const pendingNextTrick = new Map<string, {
  handle: ReturnType<typeof setTimeout>;
  winnerId: string;
  trickPoints: number;
  roomId: string;
  nextTrickNum: number;
  rotatedOrder: string[];
}>();

// gameId → round-over payload; kept so reconnecting players get results, cleared on start-next-round
export const pendingRoundResults = new Map<string, {
  attackingPoints: number;
  defendingPoints: number;
  rankChanges: Record<string, { oldRank: number; newRank: number }>;
  nextKingId: string;
  winningTeam: 'attacking' | 'defending';
  kittyBonus: number;
  gameOver: boolean;
}>();

// gameId → next king's playerId; set at round end, consumed when start-next-round fires
export const pendingNextKing = new Map<string, string>();

