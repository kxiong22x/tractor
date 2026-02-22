import { SUIT_SYMBOLS } from '../utils/cards';

interface TrumpInfoProps {
  trumpNumber: string;
  trumpSuit: string;
  trickPhase: boolean;
  trickNum: number;
  attackingPoints: number;
}

export default function TrumpInfo({ trumpNumber, trumpSuit, trickPhase, trickNum, attackingPoints }: TrumpInfoProps) {
  const trumpSuitDisplay = trumpSuit === 'NA' ? 'NA' : trumpSuit === 'NT' ? 'No Suit' : (SUIT_SYMBOLS[trumpSuit] ?? trumpSuit);

  return (
    <div
      style={{
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        color: 'white',
        padding: '0.5rem 0.875rem',
        margin: '1rem 0 0 1rem',
        borderRadius: '0.5rem',
        fontSize: '1rem',
        fontWeight: 'bold',
        display: 'inline-flex',
        flexDirection: 'column',
        gap: '0.25rem',
        zIndex: 10,
      }}
    >
      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
        <span>Trump: {trumpNumber}</span>
        <span style={{ color: (trumpSuit === 'H' || trumpSuit === 'D') ? '#ff6b6b' : 'white' }}>
          {trumpSuitDisplay}
        </span>
        {trickPhase && (
          <span style={{ fontSize: '0.8125rem', opacity: 0.8 }}>
            Trick #{trickNum}
          </span>
        )}
      </div>
      {trickPhase && (
        <div style={{ fontSize: '0.8125rem' }}>
          Attacking Team Points: {attackingPoints}
        </div>
      )}
    </div>
  );
}
