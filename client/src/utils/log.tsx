import { parseCard, getDisplayRank, getSuitSymbol, isRed } from './cards';

export type LogEntry =
  | { type: 'trick'; trickNum: number }
  | { type: 'play'; playerName: string; cards: string[] }
  | { type: 'winner'; playerName: string }
  | { type: 'declare'; playerName: string; cards: string[] }
  | { type: 'undo'; playerName: string };

export function CardSpan({ card }: { card: string }) {
  const { suit, rank } = parseCard(card);
  const text = `${getDisplayRank(suit, rank)}${getSuitSymbol(suit)}`;
  return <span style={isRed(suit, rank) ? { color: '#c00' } : undefined}>{text}</span>;
}
