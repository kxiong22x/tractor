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
