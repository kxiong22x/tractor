import { SUIT_SYMBOLS } from '../utils/cards';

interface TrumpInfoProps {
  trumpNumber: string;
  trumpSuit: string;
  trickPhase: boolean;
  attackingPoints: number;
  cardScale?: number;
}

export default function TrumpInfo({ trumpNumber, trumpSuit, trickPhase, attackingPoints, cardScale = 1 }: TrumpInfoProps) {
  const trumpSuitDisplay = trumpSuit === 'NA' ? 'NA' : (trumpSuit === 'BJ' || trumpSuit === 'SJ') ? 'No Suit' : (SUIT_SYMBOLS[trumpSuit] ?? trumpSuit);

  return (
    <div
      style={{
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        color: 'white',
        padding: `${0.5 * cardScale}rem ${0.875 * cardScale}rem`,
        margin: `${1 * cardScale}rem 0 0 ${1 * cardScale}rem`,
        borderRadius: '0.5rem',
        fontSize: `${1 * cardScale}rem`,
        fontWeight: 'bold',
        display: 'inline-flex',
        flexDirection: 'column',
        gap: `${0.25 * cardScale}rem`,
        zIndex: 10,
      }}
    >
      <div style={{ display: 'flex', gap: `${0.75 * cardScale}rem`, alignItems: 'center' }}>
        <span>Trump: {trumpNumber}</span>
        <span style={{ color: (trumpSuit === 'H' || trumpSuit === 'D') ? '#ff6b6b' : 'white' }}>
          {trumpSuitDisplay}
        </span>
      </div>
      {trickPhase && (
        <div style={{ fontSize: `${0.8125 * cardScale}rem` }}>
          Attacking Team Points: {attackingPoints}
        </div>
      )}
    </div>
  );
}
