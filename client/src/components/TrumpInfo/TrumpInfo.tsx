import { SUIT_SYMBOLS } from '../../utils/cards';
import styles from './TrumpInfo.module.css';

interface TrumpInfoProps {
  trumpNumber: string;
  trumpSuit: string;
  trickPhase: boolean;
  attackingPoints: number;
  cardScale?: number;
}

export default function TrumpInfo({ trumpNumber, trumpSuit, trickPhase, attackingPoints, cardScale = 1 }: TrumpInfoProps) {
  const trumpSuitDisplay = trumpSuit === 'NA' ? 'NA' : (trumpSuit === 'BJ' || trumpSuit === 'SJ') ? 'No Suit' : (SUIT_SYMBOLS[trumpSuit] ?? trumpSuit);
  const isRedSuit = trumpSuit === 'H' || trumpSuit === 'D';

  return (
    <div
      className={styles.container}
      style={{ '--cs': cardScale } as React.CSSProperties}
    >
      <div className={styles.trumpRow}>
        <span>Trump: {trumpNumber}</span>
        <span className={isRedSuit ? styles.suitRed : undefined}>
          {trumpSuitDisplay}
        </span>
      </div>
      {trickPhase && (
        <div className={styles.points}>
          Attacking Team Points: {attackingPoints}
        </div>
      )}
    </div>
  );
}
