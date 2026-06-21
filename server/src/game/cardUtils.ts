import { parseCard } from './deck';
import type { TrumpContext } from '../types';
import { RANK_VALUES } from './constants';

export function groupByRank(cards: string[]): Map<string, string[]> {
  const groups = new Map<string, string[]>();
  for (const card of cards) {
    const { suit, rank } = parseCard(card);
    const key = `${suit}${rank}`;
    const arr = groups.get(key) ?? [];
    arr.push(card);
    groups.set(key, arr);
  }
  return groups;
}

export function rankValue(rank: string): number {
  return RANK_VALUES[rank] ?? 0;
}

/**
 * Returns the logical suit of a card: 'TRUMP' if trump, else the face suit.
 */
export function logicalSuit(card: string, ctx: TrumpContext): string {
  const { suit, rank } = parseCard(card);
  if (suit === 'J') return 'TRUMP'; // Jokers
  if (rank === ctx.trumpNumber) return 'TRUMP'; // Trump number cards
  if (suit === ctx.trumpSuit) return 'TRUMP'; // Trump suit cards
  return suit;
}

/**
 * Returns a trump power value (1-16) for trump cards, or -1 for non-trump.
 * Higher value = stronger trump.
 *
 * Trump-suit cards by rank (skip trumpNumber): values 1..11 (up to 12 ranks minus trumpNumber)
 * Trump-number off-suit: 13
 * Trump-number on-suit: 14
 * Small Joker (JS): 15
 * Big Joker (JB): 16
 */
export function getTrumpValue(card: string, ctx: TrumpContext): number {
  const { suit, rank } = parseCard(card);

  // Jokers
  if (suit === 'J') {
    return rank === 'B' ? 16 : 15;
  }

  // Trump number cards
  if (rank === ctx.trumpNumber) {
    return suit === ctx.trumpSuit ? 14 : 13;
  }

  // Trump suit cards (non-trump-number)
  if (suit === ctx.trumpSuit) {
    // Rank among trump-suit cards, skipping the trump number
    const orderedRanks = Object.keys(RANK_VALUES).filter(r => r !== ctx.trumpNumber);
    const idx = orderedRanks.indexOf(rank);
    return idx + 1; // 1..12
  }

  return -1; // Not a trump card
}

/**
 * Returns a comparable value for a card within its logical suit context.
 * For trump cards, returns trump power. For non-trump, returns rank value
 * adjusted to skip the trump number (so cards on either side of the trump
 * number are consecutive, e.g. 4-6 when trump number is 5).
 */
export function cardValue(card: string, ctx: TrumpContext): number {
  const tv = getTrumpValue(card, ctx);
  if (tv > 0) return tv;
  const { rank } = parseCard(card);
  const rv = rankValue(rank);
  const trumpRv = rankValue(ctx.trumpNumber);
  // Shift down ranks above the trump number so the gap is closed
  return rv > trumpRv ? rv - 1 : rv;
}

export function maxCardValue(cards: string[], ctx: TrumpContext): number {
  return Math.max(...cards.map(c => cardValue(c, ctx)));
}

/** Get values of all pairs in a set of same-suit cards */
export function getPairValues(suitCards: string[], ctx: TrumpContext): number[] {
  const groups = new Map<string, string[]>();
  for (const card of suitCards) {
    const { suit: fs, rank } = parseCard(card);
    const key = `${fs}${rank}`;
    const arr = groups.get(key) ?? [];
    arr.push(card);
    groups.set(key, arr);
  }
  const values: number[] = [];
  for (const [, arr] of groups) {
    if (arr.length >= 2) {
      values.push(cardValue(arr[0], ctx));
    }
  }
  return values;
}

export function countPairsOfSuit(cards: string[], suit: string, ctx: TrumpContext): number {
  const suitCards = cards.filter(c => logicalSuit(c, ctx) === suit);
  const groups = new Map<string, number>();
  for (const card of suitCards) {
    const { suit: fs, rank } = parseCard(card);
    const key = `${fs}${rank}`;
    groups.set(key, (groups.get(key) ?? 0) + 1);
  }
  let pairs = 0;
  for (const count of groups.values()) {
    pairs += Math.floor(count / 2);
  }
  return pairs;
}

export function findTractorsOfSuit(cards: string[], suit: string, ctx: TrumpContext): { length: number; value: number }[] {
  const suitCards = cards.filter(c => logicalSuit(c, ctx) === suit);

  // Group into pairs
  const groups = new Map<string, string[]>();
  for (const card of suitCards) {
    const { suit: fs, rank } = parseCard(card);
    const key = `${fs}${rank}`;
    const arr = groups.get(key) ?? [];
    arr.push(card);
    groups.set(key, arr);
  }

  // Get pair values
  const pairValues: number[] = [];
  for (const [, arr] of groups) {
    if (arr.length >= 2) {
      pairValues.push(cardValue(arr[0], ctx));
    }
  }
  pairValues.sort((a, b) => a - b);

  if (pairValues.length < 2) return [];

  // Find consecutive runs
  const tractors: { length: number; value: number }[] = [];
  let start = 0;
  for (let i = 1; i <= pairValues.length; i++) {
    if (i === pairValues.length || pairValues[i] - pairValues[i - 1] !== 1) {
      const len = i - start;
      if (len >= 2) {
        tractors.push({ length: len, value: pairValues[start] });
      }
      start = i;
    }
  }
  return tractors;
}
