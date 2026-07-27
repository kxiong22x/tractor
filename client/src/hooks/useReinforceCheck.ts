import { useEffect, type Dispatch } from 'react';
import type { GameAction } from '../pages/GamePage/gameState';
import { cardsDealtForPlayer } from '../utils/seats';

interface UseReinforceCheckParams {
  canReinforce: boolean;
  reinforceCloseAtCardCount: number | null;
  handInitialized: boolean;
  currentIndex: number;
  globalDealTick: number;
  playerCount: number;
  rawHandLength: number;
  dispatch: Dispatch<GameAction>;
}

// Clears the reinforce opportunity once enough cards have been dealt to the player, preventing a stale
// reinforce window from persisting past the valid window. Used by GamePage on every deal tick.
export function useReinforceCheck({
  canReinforce,
  reinforceCloseAtCardCount,
  handInitialized,
  currentIndex,
  globalDealTick,
  playerCount,
  rawHandLength,
  dispatch,
}: UseReinforceCheckParams) {
  useEffect(() => {
    if (!canReinforce || reinforceCloseAtCardCount === null || handInitialized) return;
    const currentCount = cardsDealtForPlayer(currentIndex, globalDealTick, playerCount, rawHandLength);
    if (currentCount >= reinforceCloseAtCardCount) {
      dispatch({ type: 'CLEAR_REINFORCE' });
      dispatch({ type: 'CLEAR_STAGED' });
    }
  }, [globalDealTick]);
}
