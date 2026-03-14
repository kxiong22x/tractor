import { useEffect } from 'react';
import type { MutableRefObject, Dispatch } from 'react';
import type { NavigateFunction } from 'react-router-dom';
import type { Socket } from 'socket.io-client';
import type { GamePlayer, GameAction, RoundResult } from '../gameState';
import { parseCard } from '../utils/cards';
import { cardsDealtForPlayer } from '../utils/seats';

interface UseGameSocketParams {
  socket: Socket;
  currentPlayer: GamePlayer | null;
  currentIndex: number;
  players: GamePlayer[];
  rawHandRef: MutableRefObject<string[]>;
  globalDealTickRef: MutableRefObject<number>;
  dispatch: Dispatch<GameAction>;
  navigate: NavigateFunction;
  setRoundResult: (result: RoundResult | null) => void;
  setThrowError: (error: string | null) => void;
  setGlobalDealTick: (tick: number) => void;
  setDisconnectedPlayerName: (name: string | null) => void;
}

export function useGameSocket({
  socket,
  currentPlayer,
  currentIndex,
  players,
  rawHandRef,
  globalDealTickRef,
  dispatch,
  navigate,
  setRoundResult,
  setThrowError,
  setGlobalDealTick,
  setDisconnectedPlayerName,
}: UseGameSocketParams) {
  useEffect(() => {
    const onTrumpDeclared = (data: { trumpSuit: string; declarerId: string; isPair: boolean; roundKingId: string }) => {
      dispatch({ type: 'TRUMP_DECLARED', ...data });
    };

    const onKittyPickedUp = (data: { kittyCards?: string[] }) => {
      dispatch({ type: 'KITTY_PICKED_UP', kittyCards: data.kittyCards });
    };

    const onKittyFinished = () => {
      dispatch({ type: 'KITTY_FINISHED' });
    };

    const onTrickStarted = (data: { leaderId: string; trickNum: number; playerOrder: string[] }) => {
      dispatch({ type: 'TRICK_STARTED', ...data });
    };

    const onCardsPlayed = (data: { playerId: string; cards: string[] }) => {
      dispatch({ type: 'CARDS_PLAYED', ...data, currentPlayerId: currentPlayer?.player_id });
    };

    const onTurnAdvanced = (data: { currentTurn: string }) => {
      dispatch({ type: 'TURN_ADVANCED', currentTurn: data.currentTurn });
    };

    const onTrickComplete = (data: { winnerId: string; points?: Record<string, number> }) => {
      dispatch({ type: 'TRICK_COMPLETE', ...data });
    };

    const onPlayError = (data: { message: string }) => {
      console.error('Play error:', data.message);
      dispatch({ type: 'PLAY_ERROR' });
    };

    const onThrowFailed = (data: { message: string; failedCards?: string[]; returnedCards?: string[] }) => {
      console.error('Throw failed:', data.message);
      setThrowError(data.message);
      dispatch({ type: 'PLAY_ERROR' });
      setTimeout(() => setThrowError(null), 3000);
    };

    const onRoundOver = (data: RoundResult) => {
      setRoundResult(data);
      dispatch({ type: 'ROUND_OVER', rankChanges: data.rankChanges });
    };

    const onGameStarted = (data: {
      gameId: string;
      players: GamePlayer[];
      trumpNumber: string;
      trumpSuit: string;
      roundKingId: string | null;
      roundNumber?: number;
    }) => {
      dispatch({ type: 'GAME_STARTED', ...data });
      setRoundResult(null);
      setThrowError(null);
      setGlobalDealTick(0);
    };

    const onDealTick = (data: { tick: number }) => {
      setGlobalDealTick(data.tick);
    };

    const onDealingComplete = () => {
      dispatch({ type: 'INIT_HAND', hand: rawHandRef.current });
    };

    const onPlayUndone = (data: { playerId: string; cards: string[]; trickUndone: boolean; points?: Record<string, number> }) => {
      dispatch({ type: 'PLAY_UNDONE', ...data, currentPlayerId: currentPlayer?.player_id });
    };

    const onGameAbandoned = () => {
      navigate('/');
    };

    const onPlayerDisconnected = (data: { playerId: string; playerName: string }) => {
      setDisconnectedPlayerName(data.playerName);
    };

    const onPlayerReconnected = (data: { playerId: string; players: GamePlayer[] }) => {
      setDisconnectedPlayerName(null);
      dispatch({ type: 'UPDATE_PLAYERS', players: data.players });
    };

    const onCanReinforce = (data: { targetPlayerId: string; card: string }) => {
      if (data.targetPlayerId === currentPlayer?.player_id) {
        const { suit, rank } = parseCard(data.card);
        const matchingCards = rawHandRef.current.filter(c => {
          const p = parseCard(c);
          return p.suit === suit && p.rank === rank;
        });
        if (matchingCards.length < 2) return;
        const currentCount = cardsDealtForPlayer(currentIndex, globalDealTickRef.current, players.length, rawHandRef.current.length);
        dispatch({ type: 'REINFORCE_AVAILABLE', card: data.card, matchingCards, closeAtCardCount: currentCount + 2 });
      }
    };

    const handlers: [string, (...args: any[]) => void][] = [
      ['trump-declared', onTrumpDeclared],
      ['kitty-picked-up', onKittyPickedUp],
      ['kitty-finished', onKittyFinished],
      ['trick-started', onTrickStarted],
      ['cards-played', onCardsPlayed],
      ['turn-advanced', onTurnAdvanced],
      ['trick-complete', onTrickComplete],
      ['play-error', onPlayError],
      ['throw-failed', onThrowFailed],
      ['round-over', onRoundOver],
      ['game-started', onGameStarted],
      ['deal-tick', onDealTick],
      ['dealing-complete', onDealingComplete],
      ['play-undone', onPlayUndone],
      ['game-abandoned', onGameAbandoned],
      ['player-disconnected', onPlayerDisconnected],
      ['player-reconnected', onPlayerReconnected],
      ['can-reinforce', onCanReinforce],
    ];
    for (const [event, handler] of handlers) socket.on(event, handler);
    return () => { for (const [event, handler] of handlers) socket.off(event, handler); };
  }, [socket, currentPlayer?.player_id]);
}
