import { useEffect, type RefObject } from 'react';
import { parseCard } from '../utils/cards';
import type { GamePlayer } from '../gameState';

interface ReconnectInitParams {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  locationState: any;
  dispatch: (action: { type: string; [key: string]: unknown }) => void;
  rawHandRef: RefObject<string[]>;
  currentPlayer: GamePlayer | null;
}

export function useReconnectInit({ locationState, dispatch, rawHandRef, currentPlayer }: ReconnectInitParams) {
  useEffect(() => {
    if (locationState?.phase === 'declaration' || locationState?.phase === 'round-over') {
      dispatch({ type: 'INIT_HAND', hand: rawHandRef.current });
    } else if (locationState?.phase === 'kitty') {
      dispatch({ type: 'INIT_HAND', hand: rawHandRef.current });
      dispatch({ type: 'KITTY_PICKED_UP', kittyCards: locationState?.kittyCards ?? undefined });
    } else if (locationState?.phase === 'trick' && locationState?.trickState) {
      const ts = locationState.trickState;
      const playerPoints = (locationState.players as GamePlayer[]).reduce(
        (acc: Record<string, number>, p: GamePlayer) => ({ ...acc, [p.playerId]: p.roundPoints }),
        {}
      );
      dispatch({
        type: 'RESTORE_TRICK_STATE',
        trickPlays: Object.fromEntries(ts.plays),
        trickPlayerOrder: ts.playerOrder,
        currentTurn: ts.currentTurn,
        trickCommitted: ts.committed,
        hand: rawHandRef.current,
        playerPoints,
      });
    }

    // Reinforce window: CAN_REINFORCE is emitted by the server right after REJOIN_SUCCESS,
    // but GamePage hasn't mounted yet when it arrives so the socket listener misses it.
    // Re-derive the reinforce state from the singleDeclarer data already in location.state.
    const sd = locationState?.singleDeclarer;
    const trumpDeclarerId = locationState?.trumpDeclarerId;
    if (sd && currentPlayer && sd.playerId === currentPlayer.playerId && trumpDeclarerId !== currentPlayer.playerId) {
      const { suit, rank } = parseCard(sd.card);
      const matchingCards = (rawHandRef.current ?? []).filter(c => {
        const p = parseCard(c);
        return p.suit === suit && p.rank === rank;
      });
      if (matchingCards.length >= 2) {
        dispatch({ type: 'REINFORCE_AVAILABLE', card: sd.card, matchingCards, closeAtCardCount: (rawHandRef.current ?? []).length });
      }
    }
  }, []);
}
