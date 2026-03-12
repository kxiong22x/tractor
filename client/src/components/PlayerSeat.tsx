import type { Player } from '../types';
import Card from './Card';
import { RANK_DISPLAY } from '../utils/cards';
import { positionStyles } from '../utils/player';

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

export default function PlayerSeat({ player, position, isCurrentPlayer, isRoundKing, declaredCards, isBeingDealt, playedCards, isCurrentTurn, rank, trumpSuit, trumpNumber, buttons, cardScale = 1 }: PlayerSeatProps) {
  const cardSide = position === 'bottom' ? 'above'
    : position === 'left' ? 'right'
    : position === 'right' ? 'left'
    : 'below'; // top, top-left, top-right

  const flexDirection = cardSide === 'above' ? 'column' as const
    : cardSide === 'below' ? 'column-reverse' as const
    : cardSide === 'right' ? 'row-reverse' as const
    : 'row' as const; // 'left'

  const isHorizontal = cardSide === 'left' || cardSide === 'right';

  return (
    <div style={positionStyles[position]}>
      <div
        style={{
          display: 'flex',
          flexDirection,
          alignItems: 'center',
          gap: '0.25rem',
        }}
      >
        {/* Played cards display — toward center of screen */}
        <div style={{ display: 'flex', gap: '0.25rem', justifyContent: 'center', alignItems: 'flex-end', ...(isHorizontal ? { minWidth: '2.25rem' } : { minHeight: '3.15rem' }) }}>
          {playedCards && playedCards.length > 0 && playedCards.map((card) => (
            <Card key={card} card={card} faceUp={true} size="mini" scale={cardScale} trumpSuit={trumpSuit} trumpNumber={trumpNumber} />
          ))}
        </div>
        <div
          style={{
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            gap: '0.375rem',
          }}
        >
          {buttons && buttons.length > 0 && (
            <div style={{ position: 'absolute', right: '100%', paddingRight: `${0.5 * cardScale}rem`, display: 'flex', gap: `${0.375 * cardScale}rem` }}>
              {buttons.map((btn) => (
                <button
                  key={btn.label}
                  onClick={btn.onClick}
                  disabled={!btn.enabled}
                  style={{
                    padding: `${0.4 * cardScale}rem ${1 * cardScale}rem`,
                    fontSize: `${0.875 * cardScale}rem`,
                    fontWeight: 'bold',
                    backgroundColor: btn.enabled ? (btn.color ?? '#4CAF50') : '#888',
                    color: 'white',
                    border: 'none',
                    borderRadius: '0.5rem',
                    cursor: btn.enabled ? 'pointer' : 'not-allowed',
                    opacity: btn.enabled ? 1 : 0.6,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {btn.label}
                </button>
              ))}
            </div>
          )}
          <div
            style={{
              padding: `${0.75 * cardScale}rem ${1.25 * cardScale}rem`,
              backgroundColor: isCurrentPlayer ? '#f7892e' : '#bbbbbb',
              color: 'white',
              borderRadius: '0.5rem',
              textAlign: 'center',
              minWidth: `${5 * cardScale}rem`,
              outline: isCurrentTurn
                ? '0.1875rem solid #ffd700'
                : isBeingDealt
                ? '0.125rem solid #ff4444'
                : 'none',
              outlineOffset: '0.125rem',
              transition: 'outline 0.2s',
            }}
          >
            <div style={{ fontWeight: 'bold', fontSize: `${0.875 * cardScale}rem` }}>{player.display_name} {isRoundKing && '\ud83d\udc51'}</div>
            {rank != null && (
              <div style={{ fontSize: `${0.6875 * cardScale}rem`, opacity: 0.7, marginTop: '0.0625rem' }}>Rank: {RANK_DISPLAY[rank] ?? rank}</div>
            )}
          </div>
          {declaredCards && declaredCards.length > 0 && (
            <div style={{ display: 'flex', gap: '0.125rem' }}>
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
