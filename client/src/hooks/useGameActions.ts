import type { Dispatch } from 'react';
import { EVENTS } from '../../../shared/events';
import type { Socket } from 'socket.io-client';
import type { GameState, GameAction, GamePlayer } from '../gameState';
import { parseCard } from '../utils/cards';

interface UseGameActionsParams {
  state: GameState;
  dispatch: Dispatch<GameAction>;
  socket: Socket;
  myHand: string[];
  currentPlayer: GamePlayer | null;
}

export function useGameActions({ state, dispatch, socket, myHand, currentPlayer }: UseGameActionsParams) {
  const kittySize = state.players.length === 6 ? 6 : 8;
  const {
    gameId, phase, trumpSuit, trumpIsPair, trumpNumber,
    kittyPickedUp, kittyCards, handCards, stagedCards,
    currentTurn, trickPlays, trickComplete, canReinforce,
  } = state;

  // Check if a card is declarable (trump number card or joker pair that can be clicked)
  function isDeclarable(card: string): boolean {
    if (phase !== 'declaration') return false;
    if (kittyPickedUp) return false;

    const { suit, rank } = parseCard(card);

    // Jokers: declarable if player has a pair of the same joker
    // (can override even a pair declaration)
    if (suit === 'J') {
      if (trumpSuit === 'BJ' || trumpSuit === 'SJ') return false; // already declared jokers, final
      const matchingJokers = myHand.filter((c) => {
        const p = parseCard(c);
        return p.suit === 'J' && p.rank === rank;
      });
      return matchingJokers.length >= 2;
    }

    if (trumpIsPair) return false;
    if (rank !== trumpNumber) return false;

    if (trumpSuit === 'NA') {
      // If a card is already staged, only allow same suit (forming a pair)
      if (stagedCards.length === 1) {
        const { suit: stagedSuit } = parseCard(stagedCards[0]);
        if (suit !== stagedSuit) return false;
        const sameCards = myHand.filter(c => {
          const p = parseCard(c);
          return p.suit === suit && p.rank === trumpNumber;
        });
        return sameCards.length >= 2;
      }
      return true;
    }

    const sameCards = myHand.filter((c) => {
      const p = parseCard(c);
      return p.suit === suit && p.rank === trumpNumber;
    });

    return sameCards.length >= 2;
  }

  // Check if a card is clickable in trick phase
  function isClickableInTrickPhase(_card: string): boolean {
    if (phase !== 'trick') return false;
    if (!currentPlayer) return false;
    if (currentTurn !== currentPlayer.playerId) return false;
    if (trickComplete) return false;
    return true;
  }

  function handleKittyCardClick(card: string) {
    dispatch({ type: 'KITTY_TO_HAND', card });
  }

  function handleHandCardClickForKitty(card: string) {
    dispatch({ type: 'HAND_TO_KITTY', card });
  }

  function handleFinishKitty() {
    socket.emit(EVENTS.FINISH_KITTY, { gameId, kittyCards, handCards });
    dispatch({ type: 'FINISH_KITTY' });
  }

  function handleCardClick(card: string) {
    if (phase === 'kitty') {
      handleHandCardClickForKitty(card);
      return;
    }

    // Trick phase: toggle card in/out of staged
    if (phase === 'trick') {
      if (!isClickableInTrickPhase(card)) return;

      if (stagedCards.includes(card)) {
        dispatch({ type: 'UNSTAGE_CARD', card });
        return;
      }

      dispatch({ type: 'STAGE_CARD', card });
      return;
    }

    // Declaration phase: toggle card in/out of staged
    if (stagedCards.includes(card)) {
      if (canReinforce) return; // cards are locked while reinforce is pending
      dispatch({ type: 'UNSTAGE_CARD', card });
      return;
    }
    if (!isDeclarable(card)) return;
    if (stagedCards.length >= 2) return;
    dispatch({ type: 'STAGE_CARD', card });
  }

  function handlePlayTrick() {
    if (stagedCards.length === 0) return;
    socket.emit(EVENTS.PLAY_CARDS, { gameId, cards: stagedCards });
    dispatch({ type: 'CLEAR_STAGED' });
  }

  function handleDeclareTrump() {
    if (!canPlayDeclaration) return;
    socket.emit(EVENTS.DECLARE_TRUMP, { gameId, card: stagedCards[0], wantPair: stagedCards.length >= 2 });
    dispatch({ type: 'CLEAR_STAGED' });
  }

  function handleReinforce() {
    socket.emit(EVENTS.REINFORCE_TRUMP, { gameId });
    dispatch({ type: 'CLEAR_REINFORCE' });
    dispatch({ type: 'CLEAR_STAGED' });
  }

  // Declaration phase play button logic
  const stagedIsJoker = stagedCards.length > 0 && parseCard(stagedCards[0]).suit === 'J';
  const pairRequired = trumpSuit !== 'NA' || stagedIsJoker;
  const canPlayDeclaration = stagedCards.length > 0 && (!pairRequired || stagedCards.length >= 2);

  // Trick phase play button logic
  const isMyTurn = phase === 'trick' && currentPlayer && currentTurn === currentPlayer.playerId && !trickComplete;
  const canPlayTrick = isMyTurn && stagedCards.length > 0;

  // Determine which play handler and canPlay to use
  const inTrickPhase = phase === 'trick';
  const canPlay = inTrickPhase ? canPlayTrick : canPlayDeclaration;
  const handlePlay = inTrickPhase ? handlePlayTrick : handleDeclareTrump;

  // Show play button in declaration phase or trick phase
  const showPlayButton = stagedCards.length > 0;

  // Pick up kitty button logic
  const { handInitialized, roundKingId } = state;
  const showPickUpKitty = handInitialized && !kittyPickedUp && phase === 'declaration' && trumpSuit !== 'NA' && !!currentPlayer && currentPlayer.playerId === roundKingId;
  function handlePickUpKitty() {
    dispatch({ type: 'PICK_UP_KITTY' });
    socket.emit(EVENTS.PICK_UP_KITTY, { gameId });
  }

  // Take back logic
  const myPlayedCards = currentPlayer ? trickPlays[currentPlayer.playerId] : undefined;
  const myOrderIdx = currentPlayer ? state.trickPlayerOrder.indexOf(currentPlayer.playerId) : -1;
  const nextPlayerAfterMe = myOrderIdx >= 0
    ? state.trickPlayerOrder[(myOrderIdx + 1) % state.trickPlayerOrder.length]
    : null;

  const canUndoNormal = phase === 'trick'
    && !!myPlayedCards
    && !trickComplete
    && Object.keys(trickPlays).length < state.trickPlayerOrder.length
    && nextPlayerAfterMe === currentTurn
    && !!currentPlayer && !state.trickCommitted.includes(currentPlayer.playerId);

  const isLastPlayer = state.trickPlayerOrder.length > 0
    && currentPlayer?.playerId === state.trickPlayerOrder[state.trickPlayerOrder.length - 1];
  const canUndoLast = phase === 'trick' && !!trickComplete && isLastPlayer && !!myPlayedCards;

  const canUndoPlay = canUndoNormal || canUndoLast;

  function handleUndoPlay() {
    socket.emit(EVENTS.UNDO_PLAY, { gameId });
  }

  // Buttons shown inline next to the player name tag
  const nameTagButtons: { label: string; enabled: boolean; onClick: () => void; color?: string }[] = [];
  if (showPickUpKitty) {
    nameTagButtons.push({ label: 'Pick Up Kitty', enabled: true, onClick: handlePickUpKitty });
  }
  if (phase === 'kitty') {
    nameTagButtons.push({ label: 'Finish Kitty', enabled: kittyCards.length === kittySize, onClick: handleFinishKitty });
  } else if (canReinforce && phase === 'declaration' && !kittyPickedUp) {
    nameTagButtons.push({ label: 'Reinforce', enabled: true, onClick: handleReinforce });
  } else if (showPlayButton) {
    nameTagButtons.push({ label: inTrickPhase ? 'Play Cards' : 'Declare Trump', enabled: !!canPlay, onClick: handlePlay });
  }
  if (canUndoPlay) {
    nameTagButtons.push({ label: 'Take Back', enabled: true, onClick: handleUndoPlay, color: '#e53935' });
  }

  return {
    isDeclarable,
    isClickableInTrickPhase,
    handleKittyCardClick,
    handleCardClick,
    nameTagButtons,
  };
}
