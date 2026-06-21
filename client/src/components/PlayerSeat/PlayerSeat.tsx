import type { Player } from '../../types';
import Card from '../Card/Card';
import { RANK_DISPLAY } from '../../utils/cards';
import { positionStyles } from '../../utils/seats';
import styles from './PlayerSeat.module.css';

interface ActionButton {
  label: string;
  enabled: boolean;
  onClick: () => void;
  color?: string;
}

interface PlayerSeatProps {
  player: Player;
  position: 'top' | 'bottom' | 'left' | 'right' | 'top-left' | 'top-right';
  isCurrentPlayer: boolean;
  isRoundKing: boolean;
  declaredCards?: string[];
  isBeingDealt?: boolean;
  playedCards?: string[];
  isCurrentTurn?: boolean;
  rank?: number;
  trumpSuit: string;
  trumpNumber: string;
  buttons?: ActionButton[];
  cardScale?: number;
}

const cardSideClass: Record<string, string> = {
  above: styles['seatContent--column'],
  below: styles['seatContent--columnReverse'],
  right: styles['seatContent--rowReverse'],
  left:  styles['seatContent--row'],
};

export default function PlayerSeat({ player, position, isCurrentPlayer, isRoundKing, declaredCards, isBeingDealt, playedCards, isCurrentTurn, rank, trumpSuit, trumpNumber, buttons, cardScale = 1 }: PlayerSeatProps) {
  const cardSide = position === 'bottom' ? 'above'
    : position === 'left' ? 'right'
    : position === 'right' ? 'left'
    : 'below';

  const isHorizontal = cardSide === 'left' || cardSide === 'right';

  const nameTagClass = [
    styles.nameTag,
    isCurrentPlayer ? styles['nameTag--current'] : '',
    isCurrentTurn ? styles['nameTag--turn'] : isBeingDealt ? styles['nameTag--dealing'] : '',
  ].filter(Boolean).join(' ');

  return (
    <div style={positionStyles[position]}>
      <div
        className={`${styles.seatContent} ${cardSideClass[cardSide]}`}
        style={{ '--cs': cardScale } as React.CSSProperties}
      >
        <div className={`${styles.playedCards} ${isHorizontal ? styles['playedCards--horizontal'] : styles['playedCards--vertical']}`}>
          {playedCards && playedCards.length > 0 && playedCards.map((card) => (
            <Card key={card} card={card} faceUp={true} size="mini" scale={cardScale} trumpSuit={trumpSuit} trumpNumber={trumpNumber} />
          ))}
        </div>
        <div className={styles.nameArea}>
          {buttons && buttons.length > 0 && (
            <div className={styles.buttons}>
              {buttons.map((btn) => (
                <button
                  key={btn.label}
                  onClick={btn.onClick}
                  disabled={!btn.enabled}
                  className={styles.actionBtn}
                  style={{ backgroundColor: btn.color ?? '#4CAF50' }}
                >
                  {btn.label}
                </button>
              ))}
            </div>
          )}
          <div className={nameTagClass}>
            <div className={styles.playerName}>{player.displayName} {isRoundKing && '👑'}</div>
            {rank != null && (
              <div className={styles.playerRank}>Rank: {RANK_DISPLAY[rank] ?? rank}</div>
            )}
          </div>
          {declaredCards && declaredCards.length > 0 && (
            <div className={styles.declaredCards}>
              {declaredCards.map((card) => (
                <Card key={card} card={card} faceUp={true} size="mini" scale={cardScale} trumpSuit={trumpSuit} trumpNumber={trumpNumber} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
