export function parseCard(card: string): { suit: string; rank: string } {
  const [cardPart] = card.split('-');
  return { suit: cardPart[0], rank: cardPart.slice(1) };
}

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

export const SUIT_ORDER: Record<string, number> = { S: 0, H: 1, C: 2, D: 3, J: 4 };

export const RANK_ORDER: Record<string, number> = {
  '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10,
  'J': 11, 'Q': 12, 'K': 13, 'A': 14, 'S': 15, 'B': 16,
};

export function sortHand(cards: string[], trumpNum: string): string[] {
  function isTrumpGroup(suit: string, rank: string): boolean {
    return suit === 'J' || rank === trumpNum;
  }

  return [...cards].sort((a, b) => {
    const ca = parseCard(a);
    const cb = parseCard(b);
    const aTrump = isTrumpGroup(ca.suit, ca.rank);
    const bTrump = isTrumpGroup(cb.suit, cb.rank);

    // Trump group comes first
    if (aTrump && !bTrump) return -1;
    if (!aTrump && bTrump) return 1;

    if (aTrump && bTrump) {
      // Within trump group: jokers last (Big > Small), then by suit then rank
      const aJoker = ca.suit === 'J';
      const bJoker = cb.suit === 'J';
      if (aJoker && !bJoker) return 1;
      if (!aJoker && bJoker) return -1;
      if (aJoker && bJoker) return RANK_ORDER[ca.rank] - RANK_ORDER[cb.rank];
      // Both are trump-number cards: sort by suit
      const suitDiff = SUIT_ORDER[ca.suit] - SUIT_ORDER[cb.suit];
      if (suitDiff !== 0) return suitDiff;
      return 0;
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
