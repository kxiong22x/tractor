import type React from 'react';

export type SeatPosition = 'bottom' | 'left' | 'top' | 'right' | 'top-left' | 'top-right';

export const positionStyles: Record<string, React.CSSProperties> = {
  top: {
    position: 'absolute',
    top: '3%',
    left: '50%',
    transform: 'translateX(-50%)',
  },
  bottom: {
    position: 'absolute',
    bottom: '3%',
    left: '50%',
    transform: 'translateX(-50%)',
  },
  left: {
    position: 'absolute',
    left: '1.25rem',
    top: '35%',
    transform: 'translateY(-50%)',
  },
  right: {
    position: 'absolute',
    right: '1.25rem',
    top: '35%',
    transform: 'translateY(-50%)',
  },
  'top-left': {
    position: 'absolute',
    top: '3%',
    left: '25%',
    transform: 'translateX(-50%)',
  },
  'top-right': {
    position: 'absolute',
    top: '3%',
    right: '25%',
    transform: 'translateX(50%)',
  },
};

export function getPositionOrder(numPlayers: number): SeatPosition[] {
  if (numPlayers === 5) return ['bottom', 'left', 'top-left', 'top-right', 'right'];
  if (numPlayers === 6) return ['bottom', 'left', 'top-left', 'top', 'top-right', 'right'];
  return ['bottom', 'left', 'top', 'right'];
}

export function cardsDealtForPlayer(joinIndex: number, tick: number, numPlayers: number, cardsPerPlayer: number): number {
  if (tick <= joinIndex) return 0;
  return Math.min(cardsPerPlayer, Math.floor((tick - joinIndex - 1) / numPlayers) + 1);
}
