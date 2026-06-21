import { parseCard, isTrumpCard, getDisplayRank, getSuitSymbol, isRed, SMALL_SCALE, MINI_SCALE, CARD_WIDTH_REM } from '../../utils/cards';
import styles from './Card.module.css';

interface CardProps {
  card: string;
  faceUp: boolean;
  size?: 'normal' | 'mini' | 'small';
  scale?: number;
  selected?: boolean;
  trumpSuit?: string;
  trumpNumber?: string;
}

export default function Card({ card, faceUp, size = 'normal', scale = 1, selected = false, trumpSuit, trumpNumber }: CardProps) {
  const sizeMultiplier = (size === 'mini' ? MINI_SCALE : size === 'small' ? SMALL_SCALE : 1) * scale;
  const borderPx = size === 'normal' ? 2 : 1;
  const cssVars = { '--sm': sizeMultiplier, '--bpx': borderPx } as React.CSSProperties;

  const showTrumpMarker =
    faceUp && !!trumpSuit && !!trumpNumber && isTrumpCard(card, trumpSuit, trumpNumber);

  if (!faceUp) {
    return <div className={`${styles.card} ${styles.back}`} style={cssVars} />;
  }

  const { suit, rank } = parseCard(card);

  if (suit === 'J') {
    const src = `${import.meta.env.BASE_URL}${rank === 'B' ? 'red_joker.png' : 'black_joker.png'}`;
    return (
      <div
        className={`${styles.card} ${styles.face} ${selected ? styles.selected : ''}`}
        style={cssVars}
      >
        {showTrumpMarker && (
          <div className={`${styles.trumpMarker} ${styles['trumpMarker--joker']}`}>T</div>
        )}
        <img
          src={src}
          alt={rank === 'B' ? 'Big Joker' : 'Small Joker'}
          className={styles.jokerImg}
        />
      </div>
    );
  }

  const displayRank = getDisplayRank(suit, rank);
  const suitSymbol = getSuitSymbol(suit);
  const colorClass = isRed(suit, rank) ? styles.red : '';

  return (
    <div
      className={`${styles.card} ${styles.face} ${colorClass} ${selected ? styles.selected : ''}`}
      style={cssVars}
    >
      {showTrumpMarker && (
        <div className={styles.trumpMarker}>T</div>
      )}
      <div className={styles.corner}>
        <span className={styles.cornerText}>{displayRank}</span>
        <span className={styles.cornerText}>{suitSymbol}</span>
      </div>
      <div className={styles.center}>{suitSymbol}</div>
      {size !== 'mini' && (
        <div className={styles.cornerBottom}>
          <span className={styles.cornerText}>{displayRank}</span>
          <span className={styles.cornerText}>{suitSymbol}</span>
        </div>
      )}
    </div>
  );
}
