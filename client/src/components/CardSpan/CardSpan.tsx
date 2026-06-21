import { parseCard, getDisplayRank, getSuitSymbol, isRed } from '../../utils/cards';

export default function CardSpan({ card }: { card: string }) {
  const { suit, rank } = parseCard(card);
  const text = `${getDisplayRank(suit, rank)}${getSuitSymbol(suit)}`;
  return <span style={isRed(suit, rank) ? { color: '#c00' } : undefined}>{text}</span>;
}
