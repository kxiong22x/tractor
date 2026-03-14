// Shared card utilities used by both client and server.

export function parseCard(card: string): { suit: string; rank: string } {
  const [cardPart] = card.split('-');
  return { suit: cardPart[0], rank: cardPart.slice(1) };
}

/**
 * Returns true if the card belongs to the trump group:
 *   - Jokers (suit === 'J')
 *   - Trump-number cards of any suit
 *   - Trump-suit cards (when a real suit has been declared)
 */
export function isTrumpCard(card: string, trumpSuit: string, trumpNumber: string): boolean {
  const { suit, rank } = parseCard(card);
  if (suit === 'J') return true;
  if (rank === trumpNumber) return true;
  if (trumpSuit !== 'NA' && trumpSuit !== 'BJ' && trumpSuit !== 'SJ' && suit === trumpSuit) return true;
  return false;
}
