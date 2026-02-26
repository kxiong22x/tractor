import { parseCard } from './deck';
import type { TrumpContext, PlayShape } from './types';
import { RANK_VALUES } from './constants';

function groupByRank(cards: string[]): Map<string, string[]> {
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
function cardValue(card: string, ctx: TrumpContext): number {
  const tv = getTrumpValue(card, ctx);
  if (tv > 0) return tv;
  const { rank } = parseCard(card);
  const rv = rankValue(rank);
  const trumpRv = rankValue(ctx.trumpNumber);
  // Shift down ranks above the trump number so the gap is closed
  return rv > trumpRv ? rv - 1 : rv;
}

/**
 * Classify a play as single, pair, tractor, throw, or invalid.
 */
export function classifyPlay(cards: string[], ctx: TrumpContext): PlayShape {
  if (cards.length === 0) return { type: 'invalid', suit: '' };

  // All cards must share the same logical suit
  const suits = cards.map(c => logicalSuit(c, ctx));
  const suit = suits[0];
  if (!suits.every(s => s === suit)) return { type: 'invalid', suit: '' };

  if (cards.length === 1) {
    return { type: 'single', suit };
  }

  if (cards.length === 2) {
    // Pair: same face suit AND rank (only deck index differs)
    const p0 = parseCard(cards[0]);
    const p1 = parseCard(cards[1]);
    if (p0.suit === p1.suit && p0.rank === p1.rank) {
      return { type: 'pair', suit };
    }
    // 2-card throw: two different singles of the same suit
    return decomposeThrow(cards, ctx);
  }

  // Group into pairs by face suit+rank
  const groups = groupByRank(cards);

  // Check if it's a valid tractor (all groups are pairs, consecutive values)
  if (cards.length % 2 === 0) {
    const allPairs = Array.from(groups.values()).every(arr => arr.length === 2);
    const numPairs = groups.size;

    if (allPairs && numPairs >= 2) {
      const pairValues = Array.from(groups.entries()).map(([, arr]) => ({
        cards: arr,
        value: cardValue(arr[0], ctx),
      }));
      pairValues.sort((a, b) => a.value - b.value);

      let isConsecutive = true;
      for (let i = 1; i < pairValues.length; i++) {
        if (pairValues[i].value - pairValues[i - 1].value !== 1) {
          isConsecutive = false;
          break;
        }
      }

      if (isConsecutive) {
        return { type: 'tractor', tractorLength: numPairs, suit };
      }
    }
  }

  // Try decomposing as a throw
  return decomposeThrow(cards, ctx);
}

/**
 * Decompose cards into a throw (multiple sub-components of the same suit).
 * Greedily extracts largest tractors first, then pairs, then singles.
 * Returns the throw shape, or invalid if cards don't share a suit.
 */
function decomposeThrow(cards: string[], ctx: TrumpContext): PlayShape {
  const suits = cards.map(c => logicalSuit(c, ctx));
  const suit = suits[0];
  if (!suits.every(s => s === suit)) return { type: 'invalid', suit: '' };

  // Group by face suit+rank
  const groups = groupByRank(cards);

  // Build pair values (groups with 2+ cards)
  const pairEntries: { key: string; value: number }[] = [];
  for (const [key, arr] of groups) {
    if (arr.length >= 2) {
      pairEntries.push({ key, value: cardValue(arr[0], ctx) });
    }
  }
  pairEntries.sort((a, b) => a.value - b.value);

  const components: PlayShape[] = [];
  const usedKeys = new Set<string>();

  // Greedily extract tractors (longest first)
  if (pairEntries.length >= 2) {
    // Find consecutive runs among pair values
    const runs: { keys: string[]; startValue: number }[] = [];
    let runStart = 0;
    for (let i = 1; i <= pairEntries.length; i++) {
      if (i === pairEntries.length || pairEntries[i].value - pairEntries[i - 1].value !== 1) {
        const len = i - runStart;
        if (len >= 2) {
          runs.push({
            keys: pairEntries.slice(runStart, i).map(e => e.key),
            startValue: pairEntries[runStart].value,
          });
        }
        runStart = i;
      }
    }

    // Use each run as a tractor
    for (const run of runs) {
      components.push({ type: 'tractor', tractorLength: run.keys.length, suit });
      for (const key of run.keys) {
        usedKeys.add(key);
      }
    }
  }

  // Remaining pairs (not part of tractors)
  for (const entry of pairEntries) {
    if (!usedKeys.has(entry.key)) {
      components.push({ type: 'pair', suit });
      usedKeys.add(entry.key);
    }
  }

  // Singles: groups with exactly 1 card, or leftover from groups with odd counts
  for (const [key, arr] of groups) {
    const pairCount = usedKeys.has(key) ? Math.floor(arr.length / 2) : 0;
    const remaining = arr.length - pairCount * 2;
    for (let i = 0; i < remaining; i++) {
      components.push({ type: 'single', suit });
    }
  }

  if (components.length === 0) return { type: 'invalid', suit: '' };
  if (components.length === 1) return components[0];

  // Sort components: tractors first (longest first), then pairs, then singles
  components.sort((a, b) => {
    const order = { tractor: 0, pair: 1, single: 2, throw: 3, invalid: 4 };
    if (order[a.type] !== order[b.type]) return order[a.type] - order[b.type];
    if (a.type === 'tractor' && b.type === 'tractor') {
      return (b.tractorLength ?? 0) - (a.tractorLength ?? 0);
    }
    return 0;
  });

  return { type: 'throw', suit, components };
}

/**
 * Validate a throw against all opponents' hands.
 * For each sub-component, checks if any opponent can beat it with same-suit cards.
 * Returns the weakest beaten component on failure.
 */
export function validateThrow(
  components: PlayShape[],
  cards: string[],
  opponentHands: string[][],
  ctx: TrumpContext,
): { valid: boolean; failedComponent?: PlayShape; failedComponentCards?: string[] } {
  const suit = components[0]?.suit ?? '';

  // We need to map components back to actual cards for the failed case
  // Group cards by face suit+rank, sorted by card value
  const groups = groupByRank(cards);

  // Build sorted pair entries for mapping
  const pairEntries: { key: string; value: number; cards: string[] }[] = [];
  const singleEntries: { key: string; value: number; card: string }[] = [];

  for (const [key, arr] of groups) {
    if (arr.length >= 2) {
      pairEntries.push({ key, value: cardValue(arr[0], ctx), cards: arr.slice(0, 2) });
      // If odd count, leftover is a single
      if (arr.length > 2) {
        singleEntries.push({ key, value: cardValue(arr[0], ctx), card: arr[2] });
      }
    } else {
      singleEntries.push({ key, value: cardValue(arr[0], ctx), card: arr[0] });
    }
  }
  pairEntries.sort((a, b) => a.value - b.value);
  singleEntries.sort((a, b) => a.value - b.value);

  // Check each component from weakest to strongest
  // We want to return the weakest beaten component
  // Sort components by "strength" - singles weakest, then pairs, then tractors; within same type, by card value
  const componentDetails: { component: PlayShape; value: number; cards: string[] }[] = [];

  // Reconstruct which cards belong to which component
  // Tractors consume consecutive pairs, pairs consume remaining pairs, singles consume singles
  const usedPairIndices = new Set<number>();

  for (const comp of components) {
    if (comp.type === 'tractor') {
      const len = comp.tractorLength ?? 2;
      // Find a consecutive run of `len` pairs
      for (let start = 0; start <= pairEntries.length - len; start++) {
        if (usedPairIndices.has(start)) continue;
        let valid = true;
        for (let j = start; j < start + len; j++) {
          if (usedPairIndices.has(j)) { valid = false; break; }
          if (j > start && pairEntries[j].value - pairEntries[j - 1].value !== 1) { valid = false; break; }
        }
        if (valid) {
          const tractorCards: string[] = [];
          for (let j = start; j < start + len; j++) {
            usedPairIndices.add(j);
            tractorCards.push(...pairEntries[j].cards);
          }
          componentDetails.push({ component: comp, value: pairEntries[start + len - 1].value, cards: tractorCards });
          break;
        }
      }
    }
  }

  for (const comp of components) {
    if (comp.type === 'pair') {
      for (let i = 0; i < pairEntries.length; i++) {
        if (!usedPairIndices.has(i)) {
          usedPairIndices.add(i);
          componentDetails.push({ component: comp, value: pairEntries[i].value, cards: pairEntries[i].cards });
          break;
        }
      }
    }
  }

  let singleIdx = 0;
  for (const comp of components) {
    if (comp.type === 'single') {
      if (singleIdx < singleEntries.length) {
        componentDetails.push({ component: comp, value: singleEntries[singleIdx].value, cards: [singleEntries[singleIdx].card] });
        singleIdx++;
      }
    }
  }

  // Sort by value ascending (weakest first) so we return the weakest beaten component
  componentDetails.sort((a, b) => {
    const order = { single: 0, pair: 1, tractor: 2, throw: 3, invalid: 4 };
    if (order[a.component.type] !== order[b.component.type]) return order[a.component.type] - order[b.component.type];
    return a.value - b.value;
  });

  for (const detail of componentDetails) {
    const compValue = detail.value;

    for (const hand of opponentHands) {
      const opponentSuitCards = hand.filter(c => logicalSuit(c, ctx) === suit);

      if (detail.component.type === 'single') {
        // Can any opponent play a higher single of same suit?
        const hasHigher = opponentSuitCards.some(c => cardValue(c, ctx) > compValue);
        if (hasHigher) {
          return { valid: false, failedComponent: detail.component, failedComponentCards: detail.cards };
        }
      } else if (detail.component.type === 'pair') {
        // Can any opponent play a higher pair of same suit?
        const opponentPairs = getPairValues(opponentSuitCards, ctx);
        if (opponentPairs.some(v => v > compValue)) {
          return { valid: false, failedComponent: detail.component, failedComponentCards: detail.cards };
        }
      } else if (detail.component.type === 'tractor') {
        const tractorLen = detail.component.tractorLength ?? 2;
        // Can any opponent play a higher tractor of same length?
        const opponentTractors = findTractorsOfSuit(hand, suit, ctx);
        if (opponentTractors.some(t => t.length >= tractorLen && t.value + t.length - 1 > compValue)) {
          return { valid: false, failedComponent: detail.component, failedComponentCards: detail.cards };
        }
      }
    }
  }

  return { valid: true };
}

/** Get values of all pairs in a set of same-suit cards */
function getPairValues(suitCards: string[], ctx: TrumpContext): number[] {
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

/**
 * Validate that a follower's play follows suit rules.
 */
export function validateFollow(
  leaderShape: PlayShape,
  followerCards: string[],
  followerHand: string[],
  ctx: TrumpContext,
): { valid: boolean; reason?: string } {
  const ledSuit = leaderShape.suit;
  const requiredCount = leaderShape.type === 'single' ? 1
    : leaderShape.type === 'pair' ? 2
    : leaderShape.type === 'throw' ? throwCardCount(leaderShape)
    : (leaderShape.tractorLength ?? 2) * 2;

  if (followerCards.length !== requiredCount) {
    return { valid: false, reason: `Must play exactly ${requiredCount} cards` };
  }

  // Cards of the led suit in follower's full hand (including the cards being played)
  const suitCardsInHand = followerHand.filter(c => logicalSuit(c, ctx) === ledSuit);
  const suitCardsPlayed = followerCards.filter(c => logicalSuit(c, ctx) === ledSuit);

  if (leaderShape.type === 'single') {
    // Must play a card of led suit if you have any
    if (suitCardsInHand.length > 0 && suitCardsPlayed.length === 0) {
      return { valid: false, reason: `Must follow suit (${ledSuit})` };
    }
    return { valid: true };
  }

  if (leaderShape.type === 'pair') {
    // Find pairs of led suit in hand
    const pairsInHand = countPairsOfSuit(followerHand, ledSuit, ctx);

    if (pairsInHand > 0) {
      // Must play a pair of led suit
      const playedPairs = countPairsOfSuit(followerCards, ledSuit, ctx);
      if (playedPairs === 0) {
        return { valid: false, reason: `Must play a pair of ${ledSuit}` };
      }
      return { valid: true };
    }

    // No pairs: play as many singles of that suit as possible
    const maxSuitCards = Math.min(suitCardsInHand.length, requiredCount);
    if (suitCardsPlayed.length < maxSuitCards) {
      return { valid: false, reason: `Must play as many ${ledSuit} cards as possible` };
    }
    return { valid: true };
  }

  if (leaderShape.type === 'throw') {
    return validateFollowThrow(leaderShape, followerCards, followerHand, ctx);
  }

  if (leaderShape.type === 'tractor') {
    const targetLen = leaderShape.tractorLength ?? 2;

    // Check for tractors of same length in hand
    const tractorsInHand = findTractorsOfSuit(followerHand, ledSuit, ctx);
    const maxTractorLen = tractorsInHand.length > 0 ? Math.max(...tractorsInHand.map(t => t.length)) : 0;

    if (maxTractorLen >= targetLen) {
      // Must play a tractor of the same length
      const playShape = classifyPlay(followerCards, ctx);
      if (playShape.type === 'tractor' && playShape.tractorLength === targetLen && playShape.suit === ledSuit) {
        return { valid: true };
      }
      return { valid: false, reason: `Must play a tractor of length ${targetLen} in ${ledSuit}` };
    }

    // No matching tractor: try longest tractor of that suit
    if (maxTractorLen >= 2) {
      // Must include a tractor of the longest available length
      const tractorsPlayed = findTractorsOfSuit(followerCards, ledSuit, ctx);
      const maxPlayedLen = tractorsPlayed.length > 0 ? Math.max(...tractorsPlayed.map(t => t.length)) : 0;
      if (maxPlayedLen < maxTractorLen) {
        return { valid: false, reason: `Must play your longest tractor of ${ledSuit}` };
      }
      // Remaining should be pairs, then singles of that suit, then anything
      const tractorCards = maxTractorLen * 2;
      const remaining = requiredCount - tractorCards;
      return validateRemainder(followerCards, followerHand, ledSuit, remaining, tractorCards, ctx);
    }

    // No tractors: try pairs
    const pairsInHand = countPairsOfSuit(followerHand, ledSuit, ctx);
    if (pairsInHand > 0) {
      const pairsPlayed = countPairsOfSuit(followerCards, ledSuit, ctx);
      const maxPairsNeeded = Math.min(pairsInHand, Math.floor(requiredCount / 2));
      if (pairsPlayed < maxPairsNeeded) {
        return { valid: false, reason: `Must play as many pairs of ${ledSuit} as possible` };
      }
      // Rest should be singles of that suit, then anything
      const pairCardCount = pairsPlayed * 2;
      const remaining = requiredCount - pairCardCount;
      const nonPairSuitCards = suitCardsInHand.length - pairsInHand * 2;
      const suitSinglesNeeded = Math.min(nonPairSuitCards, remaining);
      const suitSinglesPlayed = suitCardsPlayed.length - pairCardCount;
      if (suitSinglesPlayed < suitSinglesNeeded) {
        return { valid: false, reason: `Must play as many ${ledSuit} cards as possible` };
      }
      return { valid: true };
    }

    // No pairs or tractors: play as many singles of that suit as possible
    const maxSuitCards = Math.min(suitCardsInHand.length, requiredCount);
    if (suitCardsPlayed.length < maxSuitCards) {
      return { valid: false, reason: `Must play as many ${ledSuit} cards as possible` };
    }
    return { valid: true };
  }

  return { valid: true };
}

/** Count total cards in a throw shape */
function throwCardCount(shape: PlayShape): number {
  if (!shape.components) return 0;
  let count = 0;
  for (const comp of shape.components) {
    if (comp.type === 'single') count += 1;
    else if (comp.type === 'pair') count += 2;
    else if (comp.type === 'tractor') count += (comp.tractorLength ?? 2) * 2;
  }
  return count;
}

/**
 * Validate follow-suit for a throw lead.
 * Follower must match structure (tractors → pairs → singles of led suit) as much as possible.
 */
function validateFollowThrow(
  leaderShape: PlayShape,
  followerCards: string[],
  followerHand: string[],
  ctx: TrumpContext,
): { valid: boolean; reason?: string } {
  const ledSuit = leaderShape.suit;
  const components = leaderShape.components ?? [];

  // Count required structure from leader
  let requiredTractors: { length: number }[] = [];
  let requiredPairs = 0;
  let requiredSingles = 0;
  for (const comp of components) {
    if (comp.type === 'tractor') requiredTractors.push({ length: comp.tractorLength ?? 2 });
    else if (comp.type === 'pair') requiredPairs++;
    else if (comp.type === 'single') requiredSingles++;
  }
  // Sort required tractors longest first
  requiredTractors.sort((a, b) => b.length - a.length);

  const suitCardsInHand = followerHand.filter(c => logicalSuit(c, ctx) === ledSuit);
  const suitCardsPlayed = followerCards.filter(c => logicalSuit(c, ctx) === ledSuit);

  // Try to match tractors from hand
  const handTractors = findTractorsOfSuit(followerHand, ledSuit, ctx);
  const playedTractors = findTractorsOfSuit(followerCards, ledSuit, ctx);

  // For each required tractor length, check if follower has one and played one
  // This is a simplified check: follower must play as many same-suit cards as possible,
  // matching the highest-level structures first
  const totalSuitInHand = suitCardsInHand.length;
  const totalRequired = throwCardCount(leaderShape);
  const maxSuitCards = Math.min(totalSuitInHand, totalRequired);

  if (suitCardsPlayed.length < maxSuitCards) {
    return { valid: false, reason: `Must play as many ${ledSuit} cards as possible` };
  }

  // If follower has enough suit cards for the full play, enforce structure matching
  if (totalSuitInHand >= totalRequired) {
    // Must match tractors if possible
    for (const req of requiredTractors) {
      const availableTractor = handTractors.find(t => t.length >= req.length);
      if (availableTractor) {
        const playedTractor = playedTractors.find(t => t.length >= req.length);
        if (!playedTractor) {
          return { valid: false, reason: `Must play a tractor of length ${req.length} in ${ledSuit}` };
        }
      }
    }

    // Must match pairs if possible (after accounting for tractor pairs)
    const handPairs = countPairsOfSuit(followerHand, ledSuit, ctx);
    const tractorPairsInHand = handTractors.reduce((sum, t) => sum + t.length, 0);
    const freePairsInHand = handPairs - tractorPairsInHand;

    if (requiredPairs > 0 && freePairsInHand > 0) {
      const playedPairs = countPairsOfSuit(followerCards, ledSuit, ctx);
      const tractorPairsPlayed = playedTractors.reduce((sum, t) => sum + t.length, 0);
      const freePairsPlayed = playedPairs - tractorPairsPlayed;
      const neededPairs = Math.min(requiredPairs, freePairsInHand);
      if (freePairsPlayed < neededPairs) {
        return { valid: false, reason: `Must play as many pairs of ${ledSuit} as possible` };
      }
    }
  }

  return { valid: true };
}

function validateRemainder(
  followerCards: string[],
  followerHand: string[],
  ledSuit: string,
  _remaining: number,
  _tractorCards: number,
  ctx: TrumpContext,
): { valid: boolean; reason?: string } {
  // After tractor obligation, fill with pairs then singles of that suit, then anything
  const suitCardsInHand = followerHand.filter(c => logicalSuit(c, ctx) === ledSuit);
  const suitCardsPlayed = followerCards.filter(c => logicalSuit(c, ctx) === ledSuit);
  const totalSuitInHand = suitCardsInHand.length;
  const maxSuitCards = Math.min(totalSuitInHand, followerCards.length);

  if (suitCardsPlayed.length < maxSuitCards) {
    return { valid: false, reason: `Must play as many ${ledSuit} cards as possible` };
  }
  return { valid: true };
}

function countPairsOfSuit(cards: string[], suit: string, ctx: TrumpContext): number {
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

function findTractorsOfSuit(cards: string[], suit: string, ctx: TrumpContext): { length: number; value: number }[] {
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

/**
 * Determine the winner of a trick.
 */
export function determineTrickWinner(
  plays: Map<string, string[]>,
  leaderId: string,
  ctx: TrumpContext,
): string {
  const leaderCards = plays.get(leaderId)!;
  const leaderShape = classifyPlay(leaderCards, ctx);
  const ledSuit = leaderShape.suit;

  let bestPlayerId = leaderId;
  let bestValue = maxCardValue(leaderCards, ctx);
  let bestIsTrump = ledSuit === 'TRUMP';

  for (const [playerId, cards] of plays) {
    if (playerId === leaderId) continue;

    const shape = classifyPlay(cards, ctx);
    const isTrump = shape.suit === 'TRUMP';
    const value = maxCardValue(cards, ctx);

    // Must match combo type to win
    if (leaderShape.type === 'single') {
      if (shape.type !== 'single') continue;
    } else if (leaderShape.type === 'pair') {
      // Only a pair can beat a pair
      if (shape.type !== 'pair') continue;
    } else if (leaderShape.type === 'tractor') {
      // Only a tractor of same length can beat
      if (shape.type !== 'tractor' || shape.tractorLength !== leaderShape.tractorLength) continue;
    } else if (leaderShape.type === 'throw') {
      // A throw can only be beaten by an all-trump play matching the throw's exact structure
      if (!cards.every(c => logicalSuit(c, ctx) === 'TRUMP')) continue;
      if (!throwStructureMatches(cards, leaderShape, ctx)) continue;
      // Qualifying — fall through to the trump comparison logic below
    }

    if (ledSuit === 'TRUMP') {
      // Trump lead: only trump can win, higher value wins
      if (!isTrump) continue;
      if (value > bestValue) {
        bestPlayerId = playerId;
        bestValue = value;
        bestIsTrump = true;
      }
    } else {
      // Non-trump lead
      if (isTrump && !bestIsTrump) {
        // Trump beats non-trump
        bestPlayerId = playerId;
        bestValue = value;
        bestIsTrump = true;
      } else if (isTrump && bestIsTrump) {
        // Both trump: higher wins
        if (value > bestValue) {
          bestPlayerId = playerId;
          bestValue = value;
        }
      } else if (!isTrump && !bestIsTrump) {
        // Neither trump: must be same suit as led, higher wins
        if (shape.suit === ledSuit && value > bestValue) {
          bestPlayerId = playerId;
          bestValue = value;
        }
      }
    }
  }

  return bestPlayerId;
}

function maxCardValue(cards: string[], ctx: TrumpContext): number {
  return Math.max(...cards.map(c => cardValue(c, ctx)));
}

function throwStructureMatches(followerCards: string[], throwShape: PlayShape, ctx: TrumpContext): boolean {
  const throwComponents = throwShape.components;
  if (!throwComponents || throwComponents.length === 0) return false;

  // Classify the follower's all-trump play
  const followerShape = classifyPlay(followerCards, ctx);

  // Get follower component list (single/pair/tractor are one component; throw has multiple)
  let followerComponents: PlayShape[];
  if (followerShape.type === 'throw') {
    followerComponents = followerShape.components ?? [];
  } else if (followerShape.type !== 'invalid') {
    followerComponents = [followerShape];
  } else {
    return false;
  }

  // Compare tractor lengths as sorted multisets
  const tractorLengths = (comps: PlayShape[]) =>
    comps.filter(c => c.type === 'tractor').map(c => c.tractorLength ?? 2).sort((a, b) => a - b);
  const pairCount   = (comps: PlayShape[]) => comps.filter(c => c.type === 'pair').length;
  const singleCount = (comps: PlayShape[]) => comps.filter(c => c.type === 'single').length;

  const tl = tractorLengths(throwComponents);
  const fl = tractorLengths(followerComponents);
  if (tl.length !== fl.length || tl.some((len, i) => len !== fl[i])) return false;
  if (pairCount(throwComponents)   !== pairCount(followerComponents))   return false;
  if (singleCount(throwComponents) !== singleCount(followerComponents)) return false;

  return true;
}
