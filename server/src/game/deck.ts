const SUITS = ['S', 'H', 'D', 'C'] as const;
const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'] as const;

export function createDeck(): string[] {
  const cards: string[] = [];

  for (let deckIndex = 0; deckIndex < 2; deckIndex++) {
    for (const suit of SUITS) {
      for (const rank of RANKS) {
        cards.push(`${suit}${rank}-${deckIndex}`);
      }
    }
    cards.push(`JB-${deckIndex}`);
    cards.push(`JS-${deckIndex}`);
  }

  return cards; // 54 * 2 = 108 cards
}

export function shuffleDeck(deck: string[]): string[] {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}
