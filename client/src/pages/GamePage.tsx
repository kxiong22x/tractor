import { useState, useEffect, useReducer, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useSocket } from '../hooks/useSocket';
import type { Player } from '../types';
import PlayerSeat from '../components/PlayerSeat';
import TrumpInfo from '../components/TrumpInfo';
import KittyArea from '../components/KittyArea';
import RoundOverModal from '../components/RoundOverModal';
import PlayerDisconnectedModal from '../components/PlayerDisconnectedModal';
import ThrowError from '../components/ThrowError';
import TrickCompleteOverlay from '../components/TrickCompleteOverlay';
import HandDisplay from '../components/HandDisplay';
import GameLog, { type LogEntry } from '../components/GameLog';
import { parseCard, sortHand } from '../utils/cards';
import { cardsDealtForPlayer, getPositionOrder } from '../utils/player';

interface GamePlayer extends Player {
  hand: string[];
}

// ── State & Action types ──────────────────────────────────────────────

interface RoundResult {
  attackingPoints: number;
  defendingPoints: number;
  rankChanges: Record<string, { oldRank: number; newRank: number }>;
  nextKingId: string;
  winningTeam: 'attacking' | 'defending';
  kittyBonus: number;
  gameOver: boolean;
}

interface GameState {
  gameId: string;
  players: GamePlayer[];
  phase: 'declaration' | 'kitty' | 'trick';
  stagedCards: string[];
  trumpNumber: string;
  trumpSuit: string;
  trumpIsPair: boolean;
  trumpDeclarerId: string | null;
  roundKingId: string | null;
  kittyPickedUp: boolean;
  kittyCards: string[];
  handCards: string[];
  handInitialized: boolean;
  currentTurn: string | null;
  trickPlays: Record<string, string[]>;
  trickComplete: { winnerId: string; winnerName: string } | null;
  trickPlayerOrder: string[];
  playerPoints: Record<string, number>;
  trickCommitted: string[];
  log: LogEntry[];
}

type GameAction =
  | { type: 'TRUMP_DECLARED'; trumpSuit: string; declarerId: string; isPair: boolean; roundKingId: string }
  | { type: 'KITTY_PICKED_UP'; kittyCards?: string[] }
  | { type: 'KITTY_FINISHED' }
  | { type: 'TRICK_STARTED'; leaderId: string; trickNum: number; playerOrder: string[] }
  | { type: 'CARDS_PLAYED'; playerId: string; cards: string[]; currentPlayerId: string | undefined }
  | { type: 'TURN_ADVANCED'; currentTurn: string }
  | { type: 'TRICK_COMPLETE'; winnerId: string; points?: Record<string, number> }
  | { type: 'PLAY_ERROR' }
  | { type: 'ROUND_OVER'; rankChanges: Record<string, { oldRank: number; newRank: number }> }
  | { type: 'GAME_STARTED'; gameId: string; players: GamePlayer[]; trumpNumber: string; trumpSuit: string; roundKingId: string | null }
  | { type: 'STAGE_CARD'; card: string }
  | { type: 'UNSTAGE_CARD'; card: string }
  | { type: 'CLEAR_STAGED' }
  | { type: 'KITTY_TO_HAND'; card: string }
  | { type: 'HAND_TO_KITTY'; card: string }
  | { type: 'FINISH_KITTY' }
  | { type: 'PICK_UP_KITTY' }
  | { type: 'INIT_HAND'; hand: string[] }
  | { type: 'PLAY_UNDONE'; playerId: string; cards: string[]; currentPlayerId: string | undefined; trickUndone: boolean; points?: Record<string, number> }
  | { type: 'UPDATE_PLAYERS'; players: GamePlayer[] }
  | { type: 'RESTORE_TRICK_STATE'; trickPlays: Record<string, string[]>; trickPlayerOrder: string[]; currentTurn: string; trickCommitted: string[]; hand: string[]; playerPoints: Record<string, number> }
  ;

// ── Reducer ───────────────────────────────────────────────────────────

function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'TRUMP_DECLARED': {
      const declarerName = state.players.find(p => p.player_id === action.declarerId)?.display_name ?? action.declarerId;
      const isJoker = action.trumpSuit === 'BJ' || action.trumpSuit === 'SJ';
      const baseCard = isJoker ? `J${action.trumpSuit[0]}` : `${action.trumpSuit}${state.trumpNumber}`;
      const declaredCards = (isJoker || action.isPair) ? [baseCard, baseCard] : [baseCard];
      return {
        ...state,
        trumpSuit: action.trumpSuit,
        trumpDeclarerId: action.declarerId,
        trumpIsPair: action.isPair,
        roundKingId: action.roundKingId,
        stagedCards: [],
        log: [...state.log, { type: 'declare' as const, playerName: declarerName, cards: declaredCards }],
      };
    }

    case 'KITTY_PICKED_UP':
      return {
        ...state,
        kittyPickedUp: true,
        stagedCards: [],
        ...(action.kittyCards
          ? { kittyCards: action.kittyCards, phase: 'kitty' as const }
          : {}),
      };

    case 'KITTY_FINISHED':
      return { ...state, phase: 'declaration' as const, kittyCards: [] };

    case 'TRICK_STARTED':
      return {
        ...state,
        phase: 'trick' as const,
        currentTurn: action.leaderId,
        trickPlays: {},
        trickCommitted: [],
        trickComplete: null,
        trickPlayerOrder: action.playerOrder,
        stagedCards: [],
        log: [...state.log, { type: 'trick', trickNum: action.trickNum }],
      };

    case 'CARDS_PLAYED': {
      const newPlays = { ...state.trickPlays, [action.playerId]: action.cards };
      const newHand = action.playerId === action.currentPlayerId
        ? state.handCards.filter(c => !action.cards.includes(c))
        : state.handCards;
      const playerName = state.players.find(p => p.player_id === action.playerId)?.display_name ?? action.playerId;
      const nowCommitted = [...new Set([...state.trickCommitted, ...Object.keys(state.trickPlays)])];
      return {
        ...state,
        trickPlays: newPlays,
        trickCommitted: nowCommitted,
        handCards: newHand,
        log: [...state.log, { type: 'play', playerName, cards: action.cards }],
      };
    }

    case 'TURN_ADVANCED':
      return { ...state, currentTurn: action.currentTurn };

    case 'PLAY_UNDONE': {
      const newPlays = { ...state.trickPlays };
      delete newPlays[action.playerId];
      const newHand = action.playerId === action.currentPlayerId
        ? [...state.handCards, ...action.cards]
        : state.handCards;
      const undoerName = state.players.find(p => p.player_id === action.playerId)?.display_name ?? action.playerId;
      return {
        ...state,
        trickPlays: newPlays,
        handCards: newHand,
        stagedCards: [],
        currentTurn: action.playerId,
        trickComplete: action.trickUndone ? null : state.trickComplete,
        ...(action.points ? { playerPoints: action.points } : {}),
        log: [...state.log, { type: 'undo' as const, playerName: undoerName }],
      };
    }

    case 'TRICK_COMPLETE': {
      const winner = state.players.find(p => p.player_id === action.winnerId);
      const winnerName = winner?.display_name ?? 'Unknown';
      return {
        ...state,
        trickComplete: { winnerId: action.winnerId, winnerName },
        currentTurn: null,
        ...(action.points ? { playerPoints: action.points } : {}),
        log: [...state.log, { type: 'winner', playerName: winnerName }],
      };
    }

    case 'PLAY_ERROR':
      return { ...state, stagedCards: [] };

    case 'ROUND_OVER':
      return {
        ...state,
        phase: 'declaration' as const,
        currentTurn: null,
        trickPlays: {},
        players: state.players.map(p =>
          action.rankChanges[p.player_id]
            ? { ...p, rank: action.rankChanges[p.player_id].newRank }
            : p
        ),
      };

    case 'GAME_STARTED':
      return {
        ...state,
        gameId: action.gameId,
        players: action.players,
        trumpNumber: action.trumpNumber,
        trumpSuit: action.trumpSuit,
        trumpDeclarerId: null,
        trumpIsPair: false,
        roundKingId: action.roundKingId,
        kittyPickedUp: false,
        stagedCards: [],
        kittyCards: [],
        phase: 'declaration' as const,
        handCards: [],
        handInitialized: false,
        currentTurn: null,
        trickPlays: {},
        trickCommitted: [],
        trickComplete: null,
        trickPlayerOrder: [],
        playerPoints: {},
        log: [],
      };

    case 'STAGE_CARD':
      return { ...state, stagedCards: [...state.stagedCards, action.card] };

    case 'UNSTAGE_CARD':
      return { ...state, stagedCards: state.stagedCards.filter(c => c !== action.card) };

    case 'CLEAR_STAGED':
      return { ...state, stagedCards: [] };

    case 'KITTY_TO_HAND':
      return {
        ...state,
        kittyCards: state.kittyCards.filter(c => c !== action.card),
        handCards: [...state.handCards, action.card],
      };

    case 'HAND_TO_KITTY':
      if (state.kittyCards.length >= (state.players.length === 6 ? 6 : 8)) return state;
      return {
        ...state,
        handCards: state.handCards.filter(c => c !== action.card),
        kittyCards: [...state.kittyCards, action.card],
      };

    case 'FINISH_KITTY':
      return { ...state, phase: 'declaration' as const, kittyCards: [] };

    case 'PICK_UP_KITTY':
      return { ...state, kittyPickedUp: true };

    case 'INIT_HAND':
      return { ...state, handCards: action.hand, handInitialized: true };

    case 'UPDATE_PLAYERS':
      return { ...state, players: action.players };

    case 'RESTORE_TRICK_STATE':
      return {
        ...state,
        phase: 'trick' as const,
        trickPlays: action.trickPlays,
        trickPlayerOrder: action.trickPlayerOrder,
        currentTurn: action.currentTurn,
        trickCommitted: action.trickCommitted,
        handCards: action.hand,
        handInitialized: true,
        playerPoints: action.playerPoints,
      };

    default:
      return state;
  }
}

// ── Component ─────────────────────────────────────────────────────────

function buildInitialState(locationState: any): GameState {
  const players: GamePlayer[] = locationState?.players ?? [];
  return {
    players,
    gameId: locationState?.gameId ?? '',
    trumpNumber: locationState?.trumpNumber ?? '2',
    trumpSuit: locationState?.trumpSuit ?? 'NA',
    trumpDeclarerId: locationState?.trumpDeclarerId ?? null,
    trumpIsPair: locationState?.trumpIsPair ?? false,
    roundKingId: locationState?.roundKingId ?? null,
    kittyPickedUp: false,
    stagedCards: [],
    kittyCards: [],
    phase: 'declaration' as const,
    handCards: [],
    handInitialized: false,
    currentTurn: null,
    trickPlays: {},
    trickCommitted: [],
    trickComplete: null,
    trickPlayerOrder: [],
    playerPoints: {},
    log: [],
  };
}

export default function GamePage() {
  const location = useLocation();
  const navigate = useNavigate();
  const socket = useSocket();

  const [state, dispatch] = useReducer(gameReducer, location.state, buildInitialState);
  const {
    players, gameId, trumpNumber, trumpSuit, trumpDeclarerId, trumpIsPair,
    roundKingId, kittyPickedUp, stagedCards, kittyCards, phase,
    handCards, handInitialized,
    currentTurn, trickPlays,
    trickComplete, playerPoints, log,
  } = state;

  const [roundResult, setRoundResult] = useState<RoundResult | null>(location.state?.roundResult ?? null);
  const [throwError, setThrowError] = useState<string | null>(null);
  const [disconnectedPlayerName, setDisconnectedPlayerName] = useState<string | null>(null);
  const kittySize = players.length === 6 ? 6 : 8;

  // Dealing animation state — driven by server deal-tick events
  const [globalDealTick, setGlobalDealTick] = useState(location.state?.initialDealTick ?? 0);
  const rawHandRef = useRef<string[]>([]);

  // Find current player
  const currentSocketId = socket.id;
  const currentIndex = players.findIndex((p) => p.socket_id === currentSocketId);
  const currentPlayer = currentIndex >= 0 ? players[currentIndex] : null;
  const rawHand = currentPlayer?.hand ?? [];
  rawHandRef.current = rawHand;

  // Listen for events
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
    ];
    for (const [event, handler] of handlers) socket.on(event, handler);
    return () => { for (const [event, handler] of handlers) socket.off(event, handler); };
  }, [socket, currentPlayer?.player_id]);

  useEffect(() => {
    if (location.state?.phase === 'declaration' || location.state?.phase === 'round-over') {
      dispatch({ type: 'INIT_HAND', hand: rawHandRef.current });
    } else if (location.state?.phase === 'kitty') {
      dispatch({ type: 'INIT_HAND', hand: rawHandRef.current });
      dispatch({ type: 'KITTY_PICKED_UP', kittyCards: location.state?.kittyCards ?? undefined });
    } else if (location.state?.phase === 'trick' && location.state?.trickState) {
      const ts = location.state.trickState;
      const playerPoints = (location.state.players as GamePlayer[]).reduce(
        (acc: Record<string, number>, p: GamePlayer) => ({ ...acc, [p.player_id]: p.round_points }),
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
  }, []);

  if (players.length === 0) {
    return (
      <div style={{ textAlign: 'center', marginTop: '6.25rem' }}>
        <h2>No active game</h2>
        <button onClick={() => navigate('/')} style={{ marginTop: '1rem', padding: '0.5rem 1.5rem', cursor: 'pointer' }}>
          Back to Home
        </button>
      </div>
    );
  }

  // Arrange seating
  const positionOrder = getPositionOrder(players.length);
  const seatMap = players.map((_, i) => {
    const rotated = (i - currentIndex + players.length) % players.length;
    return positionOrder[rotated];
  });

  // Computed from server-driven globalDealTick — always consistent in the same render
  const isDealing = globalDealTick < rawHand.length * players.length;

  // Use handCards once populated (post-deal), otherwise use rawHand for dealing animation
  const myRevealedCount = cardsDealtForPlayer(currentIndex, globalDealTick, players.length, rawHand.length);
  const myHand = handInitialized
    ? sortHand(handCards, trumpNumber)
    : sortHand(rawHand.slice(0, myRevealedCount), trumpNumber);
  const displayHand = myHand;

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
    if (currentTurn !== currentPlayer.player_id) return false;
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
    socket.emit('finish-kitty', { gameId, kittyCards, handCards });
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
      dispatch({ type: 'UNSTAGE_CARD', card });
      return;
    }
    if (!isDeclarable(card)) return;
    if (stagedCards.length >= 2) return;
    dispatch({ type: 'STAGE_CARD', card });
  }

  function handlePlayTrick() {
    if (stagedCards.length === 0) return;
    socket.emit('play-cards', { gameId, cards: stagedCards });
    dispatch({ type: 'CLEAR_STAGED' });
  }

  function handleDeclareTrump() {
    if (!canPlayDeclaration) return;
    socket.emit('declare-trump', { gameId, card: stagedCards[0], wantPair: stagedCards.length >= 2 });
    dispatch({ type: 'CLEAR_STAGED' });
  }

  // Declaration phase play button logic
  const stagedIsJoker = stagedCards.length > 0 && parseCard(stagedCards[0]).suit === 'J';
  const pairRequired = trumpSuit !== 'NA' || stagedIsJoker;
  const canPlayDeclaration = stagedCards.length > 0 && (!pairRequired || stagedCards.length >= 2);

  // Trick phase play button logic
  const isMyTurn = phase === 'trick' && currentPlayer && currentTurn === currentPlayer.player_id && !trickComplete;
  const canPlayTrick = isMyTurn && stagedCards.length > 0;

  // Determine which play handler and canPlay to use
  const inTrickPhase = phase === 'trick';
  const canPlay = inTrickPhase ? canPlayTrick : canPlayDeclaration;
  const handlePlay = inTrickPhase ? handlePlayTrick : handleDeclareTrump;

  // Show play button in declaration phase or trick phase
  const showPlayButton = stagedCards.length > 0;

  // Pick up kitty button logic
  const showPickUpKitty = handInitialized && !kittyPickedUp && phase === 'declaration' && trumpSuit !== 'NA' && !!currentPlayer && currentPlayer.player_id === roundKingId;
  const handlePickUpKitty = () => {
    dispatch({ type: 'PICK_UP_KITTY' });
    socket.emit('pick-up-kitty', { gameId });
  };

  // Take back logic
  const myPlayedCards = currentPlayer ? state.trickPlays[currentPlayer.player_id] : undefined;
  const myOrderIdx = currentPlayer ? state.trickPlayerOrder.indexOf(currentPlayer.player_id) : -1;
  const nextPlayerAfterMe = myOrderIdx >= 0
    ? state.trickPlayerOrder[(myOrderIdx + 1) % state.trickPlayerOrder.length]
    : null;

  const canUndoNormal = phase === 'trick'
    && !!myPlayedCards
    && !state.trickComplete
    && Object.keys(trickPlays).length < state.trickPlayerOrder.length
    && nextPlayerAfterMe === currentTurn
    && !!currentPlayer && !state.trickCommitted.includes(currentPlayer.player_id);

  const isLastPlayer = state.trickPlayerOrder.length > 0
    && currentPlayer?.player_id === state.trickPlayerOrder[state.trickPlayerOrder.length - 1];
  const canUndoLast = phase === 'trick' && !!state.trickComplete && isLastPlayer && !!myPlayedCards;

  const canUndoPlay = canUndoNormal || canUndoLast;

  function handleUndoPlay() {
    socket.emit('undo-play', { gameId });
  }

  // Buttons shown inline next to the player name tag
  const nameTagButtons: { label: string; enabled: boolean; onClick: () => void; color?: string }[] = [];
  if (showPickUpKitty) {
    nameTagButtons.push({ label: 'Pick Up Kitty', enabled: true, onClick: handlePickUpKitty });
  }
  if (phase === 'kitty') {
    nameTagButtons.push({ label: 'Finish Kitty', enabled: kittyCards.length === kittySize, onClick: handleFinishKitty });
  } else if (showPlayButton) {
    nameTagButtons.push({ label: inTrickPhase ? 'Play Cards' : 'Declare Trump', enabled: !!canPlay, onClick: handlePlay });
  }
  if (canUndoPlay) {
    nameTagButtons.push({ label: 'Take Back', enabled: true, onClick: handleUndoPlay, color: '#e53935' });
  }

  const handButtons: { label: string; enabled: boolean; onClick: () => void; color?: string }[] = [];

  return (
    <div style={{ width: '100vw', height: '100vh', display: 'flex', overflow: 'hidden', backgroundColor: '#faf2e4' }}>
      <GameLog log={log} />
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          minWidth: 0,
          overflow: 'auto',
          minHeight: '100%',
        }}
      >
        {/* Row 1: Trump info */}
        <div style={{ width: '100%' }}>
          <TrumpInfo
            trumpNumber={trumpNumber}
            trumpSuit={trumpSuit}
            trickPhase={phase === 'trick'}
            attackingPoints={(() => {
              if (!roundKingId) return 0;
              const kingIdx = players.findIndex(p => p.player_id === roundKingId);
              if (kingIdx < 0) return 0;
              let total = 0;
              for (let offset = 1; offset < players.length; offset += 2) {
                const pid = players[(kingIdx + offset) % players.length].player_id;
                total += playerPoints[pid] ?? 0;
              }
              return total;
            })()}
          />
        </div>

        {/* Row 2: Player seats */}
        <div style={{ position: 'relative', flex: 1, minHeight: '22rem' }}>
          {players.map((player, i) => {
            const isDeclarer = trumpDeclarerId === player.player_id && trumpSuit !== 'NA';
            const declaredCards = isDeclarer && phase === 'declaration' && !kittyPickedUp
              ? (trumpSuit === 'BJ' || trumpSuit === 'SJ')
                ? [`J${trumpSuit[0]}-decl0`, `J${trumpSuit[0]}-decl1`]
                : trumpIsPair
                  ? [`${trumpSuit}${trumpNumber}-decl0`, `${trumpSuit}${trumpNumber}-decl1`]
                  : [`${trumpSuit}${trumpNumber}-decl0`]
              : undefined;
          return (
            <PlayerSeat
              key={player.player_id}
              player={player}
              position={seatMap[i]}
              isCurrentPlayer={player.socket_id === currentSocketId}
              isRoundKing={player.player_id === roundKingId}
              declaredCards={declaredCards}
              isBeingDealt={isDealing && globalDealTick > 0 && (globalDealTick - 1) % players.length === i}
              playedCards={trickPlays[player.player_id]}
              isCurrentTurn={phase === 'trick' && currentTurn === player.player_id}
              rank={player.rank ?? 2}
              trumpSuit={trumpSuit}
              trumpNumber={trumpNumber}
              buttons={player.socket_id === currentSocketId ? nameTagButtons : undefined}
            />
          );
        })}
      </div>

      {/* Row 3: Hand display — full width */}
      <div
        style={{
          padding: '0.5rem 1.25rem 1.25rem',
          flexShrink: 0,
        }}
      >
        {/* Kitty cards — above hand */}
        {phase === 'kitty' && (
          <div style={{ display: 'flex', justifyContent: 'center', paddingBottom: '0.75rem' }}>
          <KittyArea
            isKittyPhase={phase === 'kitty'}
            kittyCards={kittyCards}
            onKittyCardClick={handleKittyCardClick}
            trumpSuit={trumpSuit}
            trumpNumber={trumpNumber}
          />
          </div>
        )}
        <HandDisplay
          displayHand={displayHand}
          stagedCards={stagedCards}
          isKittyPhase={phase === 'kitty'}
          isDeclarable={isDeclarable}
          isClickableInTrickPhase={isClickableInTrickPhase}
          onCardClick={handleCardClick}
          buttons={handButtons}
          trumpSuit={trumpSuit}
          trumpNumber={trumpNumber}
        />
      </div>

        {/* Overlays */}
        {throwError && <ThrowError message={throwError} />}

        {trickComplete && <TrickCompleteOverlay winnerName={trickComplete.winnerName} />}

        {roundResult && (
          <RoundOverModal
            roundResult={roundResult}
            players={players}
            onNextRound={() => socket.emit('start-next-round', { gameId })}
          />
        )}

        {disconnectedPlayerName && (
          <PlayerDisconnectedModal playerName={disconnectedPlayerName} />
        )}
      </div>
    </div>
  );
}
