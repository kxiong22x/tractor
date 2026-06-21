import type { TrumpContext, PlayShape } from '../types';
import { groupByRank, logicalSuit, cardValue, maxCardValue, getPairValues, countPairsOfSuit, findTractorsOfSuit } from './cardUtils';
import { classifyPlay, throwCardCount, throwStructureMatches } from './playShape';

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
  for (const comp of components) {
    if (comp.type === 'tractor') requiredTractors.push({ length: comp.tractorLength ?? 2 });
    else if (comp.type === 'pair') requiredPairs++;
  }
  // Sort required tractors longest first
  requiredTractors.sort((a, b) => b.length - a.length);

  const suitCardsInHand = followerHand.filter(c => logicalSuit(c, ctx) === ledSuit);
  const suitCardsPlayed = followerCards.filter(c => logicalSuit(c, ctx) === ledSuit);

  // Try to match tractors from hand
  const handTractors = findTractorsOfSuit(followerHand, ledSuit, ctx);
  const playedTractors = findTractorsOfSuit(followerCards, ledSuit, ctx);

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
