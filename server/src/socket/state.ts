import { TrickState } from '../types';

export const pendingNextKing = new Map<string, string>();

export const dealingIntervals = new Map<string, ReturnType<typeof setInterval>>();

export const trickStates = new Map<string, TrickState>();

export const pendingNextTrick = new Map<string, {
  handle: ReturnType<typeof setTimeout>;
  winnerId: string;
  trickPoints: number;
  roomId: string;
  nextTrickNum: number;
  rotatedOrder: string[];
}>();

// gameId → disconnected playerId (game is frozen waiting for this player)
export const frozenGames = new Map<string, string>();

// gameIds where the kitty has been picked up but not yet buried
export const kittyPickedUpGames = new Set<string>();

// gameId → round-over payload, kept until start-next-round clears it
export const pendingRoundResults = new Map<string, {
  attackingPoints: number;
  defendingPoints: number;
  rankChanges: Record<string, { oldRank: number; newRank: number }>;
  nextKingId: string;
  winningTeam: 'attacking' | 'defending';
  kittyBonus: number;
  gameOver: boolean;
}>();

// gameId → { current: number, total: number }
export const dealingTicks = new Map<string, { current: number; total: number }>();
