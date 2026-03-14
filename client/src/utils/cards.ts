export const SMALL_SCALE = 4 / 5;
export const MINI_SCALE = 3.5 / 5;
export const CARD_WIDTH_REM = 4.5;
export const CARD_HEIGHT_REM = 6.3;

import { parseCard, isTrumpCard } from '../../../shared/cards';
export { parseCard, isTrumpCard };

export const SUIT_SYMBOLS: Record<string, string> = {
  S: '\u2660',
  H: '\u2665',
  D: '\u2666',
  C: '\u2663',
};

export const RANK_DISPLAY: Record<number, string> = {
  2: '2', 3: '3', 4: '4', 5: '5', 6: '6', 7: '7', 8: '8', 9: '9', 10: '10',
  11: 'J', 12: 'Q', 13: 'K', 14: 'A',
};

export const STARTING_RANK_OPTIONS: number[] = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];

export const SUIT_ORDER: Record<string, number> = { S: 0, H: 1, C: 2, D: 3, J: 4 };

export const RANK_ORDER: Record<string, number> = {
  '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10,
  'J': 11, 'Q': 12, 'K': 13, 'A': 14, 'S': 15, 'B': 16,
};

export function sortHand(cards: string[], trumpNum: string, trumpSuit: string): string[] {
  return [...cards].sort((a, b) => {
    const ca = parseCard(a);
    const cb = parseCard(b);
    const aTrump = isTrumpCard(a, trumpSuit, trumpNum);
    const bTrump = isTrumpCard(b, trumpSuit, trumpNum);

    // Trump group comes first
    if (aTrump && !bTrump) return -1;
    if (!aTrump && bTrump) return 1;

    if (aTrump && bTrump) {
      // Within trump group: normal trumps, then trump numbers, then jokers
      const trumpTier = (suit: string, rank: string) => {
        if (suit === 'J') return 3;
        if (rank === trumpNum && suit === trumpSuit) return 2;
        if (rank === trumpNum) return 1;
        return 0;
      };
      const tierDiff = trumpTier(ca.suit, ca.rank) - trumpTier(cb.suit, cb.rank);
      if (tierDiff !== 0) return tierDiff;
      // Within same tier: sort by rank
      return RANK_ORDER[ca.rank] - RANK_ORDER[cb.rank];
    }

    // Non-trump: sort by suit then rank
    const suitDiff = SUIT_ORDER[ca.suit] - SUIT_ORDER[cb.suit];
    if (suitDiff !== 0) return suitDiff;
    return RANK_ORDER[ca.rank] - RANK_ORDER[cb.rank];
  });
}

export function getDisplayRank(suit: string, rank: string): string {
  if (suit === 'J') return rank === 'B' ? 'Big' : 'Sm';
  return rank;
}

export function getSuitSymbol(suit: string): string {
  if (suit === 'J') return '\uD83C\uDCCF';
  return SUIT_SYMBOLS[suit] || '';
}

export function isRed(suit: string, rank: string): boolean {
  if (suit === 'J') return rank === 'B';
  return suit === 'H' || suit === 'D';
}
