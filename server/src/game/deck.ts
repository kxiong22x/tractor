const SUITS = ['S', 'H', 'D', 'C'] as const;
const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'] as const;

/** Returns kitty size: 6 for 6 players, 8 otherwise. */
export function getKittySize(numPlayers: number): number {
  return numPlayers === 6 ? 6 : 8;
}

export function parseCard(card: string): { suit: string; rank: string } {
  const [cardPart] = card.split('-');
  return { suit: cardPart[0], rank: cardPart.slice(1) };
}

/** Returns the point value of a single card (5→5, 10→10, K→10, else 0). */
export function cardPoints(card: string): number {
  const { rank } = parseCard(card);
  if (rank === '5') return 5;
  if (rank === '10' || rank === 'K') return 10;
  return 0;
}

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

/** Create a shuffled deck and deal cards to `numPlayers` players + kitty. */
export function dealCards(numPlayers: number): { hands: string[][]; kitty: string[] } {
  const deck = shuffleDeck(createDeck());
  const kittySize = getKittySize(numPlayers);
  const cardsPerPlayer = (108 - kittySize) / numPlayers;
  const hands: string[][] = Array.from({ length: numPlayers }, () => []);

  for (let i = 0; i < cardsPerPlayer * numPlayers; i++) {
    hands[i % numPlayers].push(deck[i]);
  }

  const kitty = deck.slice(cardsPerPlayer * numPlayers, cardsPerPlayer * numPlayers + kittySize);
  return { hands, kitty };
}
