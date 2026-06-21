import { parseCard } from './deck';
import type { TrumpContext, PlayShape } from '../types';
import { groupByRank, logicalSuit, cardValue } from './cardUtils';

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

/** Count total cards in a throw shape */
export function throwCardCount(shape: PlayShape): number {
  if (!shape.components) return 0;
  let count = 0;
  for (const comp of shape.components) {
    if (comp.type === 'single') count += 1;
    else if (comp.type === 'pair') count += 2;
    else if (comp.type === 'tractor') count += (comp.tractorLength ?? 2) * 2;
  }
  return count;
}

export function throwStructureMatches(followerCards: string[], throwShape: PlayShape, ctx: TrumpContext): boolean {
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
