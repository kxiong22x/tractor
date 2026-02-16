import type { Player } from '../types';
import Card from './Card';

interface PlayerSeatProps {
  player: Player;
  position: 'top' | 'bottom' | 'left' | 'right';
  isCurrentPlayer: boolean;
  isRoundKing: boolean;
  declaredCards?: string[];
  isBeingDealt?: boolean;
}

const positionStyles: Record<string, React.CSSProperties> = {
  top: {
    position: 'absolute',
    top: '20px',
    left: '50%',
    transform: 'translateX(-50%)',
  },
  bottom: {
    position: 'absolute',
    bottom: '210px',
    left: '50%',
    transform: 'translateX(-50%)',
  },
  left: {
    position: 'absolute',
    left: '20px',
    top: '35%',
    transform: 'translateY(-50%)',
  },
  right: {
    position: 'absolute',
    right: '20px',
    top: '35%',
    transform: 'translateY(-50%)',
  },
};

export default function PlayerSeat({ player, position, isCurrentPlayer, isRoundKing, declaredCards, isBeingDealt }: PlayerSeatProps) {
  return (
    <div style={positionStyles[position]}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
        }}
      >
        <div
          style={{
            padding: '12px 20px',
            backgroundColor: isCurrentPlayer ? '#f7892e' : '#bbbbbb',
            color: 'white',
            borderRadius: '8px',
            textAlign: 'center',
            minWidth: '80px',
            outline: isBeingDealt ? '2px solid #ff4444' : 'none',
            outlineOffset: '2px',
            transition: 'outline 0.1s',
          }}
        >
          <div style={{ fontWeight: 'bold', fontSize: '14px' }}>{player.display_name} {isRoundKing && '\ud83d\udc51'}</div>
        </div>
        {declaredCards && declaredCards.length > 0 && (
          <div style={{ display: 'flex', gap: '2px' }}>
            {declaredCards.map((card) => (
              <Card key={card} card={card} faceUp={true} size="mini" />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
