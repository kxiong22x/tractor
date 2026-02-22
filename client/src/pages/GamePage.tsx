import { useState, useEffect, useRef, useReducer } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useSocket } from '../hooks/useSocket';
import type { Player } from '../types';
import PlayerSeat from '../components/PlayerSeat';
import TrumpInfo from '../components/TrumpInfo';
import KittyArea from '../components/KittyArea';
import RoundOverModal from '../components/RoundOverModal';
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

interface GameState {
  players: GamePlayer[];
  gameId: string;
  trumpNumber: string;
  trumpSuit: string;
  trumpDeclarerId: string | null;
  trumpIsPair: boolean;
  roundKingId: string | null;
  kittyPickedUp: boolean;
  stagedCards: string[];
  kittyCards: string[];
  isKittyPhase: boolean;
  handCards: string[];
  handInitialized: boolean;
  roundResult: {
    attackingPoints: number;
    defendingPoints: number;
    rankChanges: Record<string, { oldRank: number; newRank: number }>;
    nextKingId: string;
    winningTeam: 'attacking' | 'defending';
    kittyBonus: number;
    gameOver: boolean;
  } | null;
  playerRanks: Record<string, number>;
  kittySize: number;
  declaredJokerRank: string | null;
  throwError: string | null;
  trickPhase: boolean;
  currentTurn: string | null;
  trickPlays: Record<string, string[]>;
  trickComplete: { winnerId: string; winnerName: string } | null;
  trickNum: number;
  trickPlayerOrder: string[];
  leaderCardCount: number;
  playerPoints: Record<string, number>;
  log: LogEntry[];
}

type GameAction =
  | { type: 'TRUMP_DECLARED'; trumpSuit: string; declarerId: string; isPair: boolean; roundKingId: string; jokerRank?: string }
  | { type: 'KITTY_PICKED_UP'; kittyCards?: string[] }
  | { type: 'KITTY_FINISHED' }
  | { type: 'TRICK_STARTED'; leaderId: string; trickNum: number; playerOrder: string[] }
  | { type: 'CARDS_PLAYED'; playerId: string; cards: string[]; currentPlayerId: string | undefined }
  | { type: 'TURN_ADVANCED'; currentTurn: string }
  | { type: 'TRICK_COMPLETE'; winnerId: string; points?: Record<string, number> }
  | { type: 'PLAY_ERROR' }
  | { type: 'THROW_FAILED'; message: string }
  | { type: 'CLEAR_THROW_ERROR' }
  | { type: 'ROUND_OVER'; attackingPoints: number; defendingPoints: number; rankChanges: Record<string, { oldRank: number; newRank: number }>; nextKingId: string; winningTeam: 'attacking' | 'defending'; kittyBonus: number; gameOver: boolean }
  | { type: 'GAME_STARTED'; gameId: string; players: GamePlayer[]; trumpNumber: string; trumpSuit: string; roundKingId: string | null; kittySize?: number }
  | { type: 'STAGE_CARD'; card: string }
  | { type: 'UNSTAGE_CARD'; card: string }
  | { type: 'CLEAR_STAGED' }
  | { type: 'KITTY_TO_HAND'; card: string }
  | { type: 'HAND_TO_KITTY'; card: string }
  | { type: 'FINISH_KITTY' }
  | { type: 'PICK_UP_KITTY' }
  | { type: 'INIT_HAND'; hand: string[] };

// ── Reducer ───────────────────────────────────────────────────────────

function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'TRUMP_DECLARED':
      return {
        ...state,
        trumpSuit: action.trumpSuit,
        trumpDeclarerId: action.declarerId,
        trumpIsPair: action.isPair,
        roundKingId: action.roundKingId,
        declaredJokerRank: action.jokerRank ?? null,
        stagedCards: [],
      };

    case 'KITTY_PICKED_UP':
      return {
        ...state,
        kittyPickedUp: true,
        ...(action.kittyCards
          ? { kittyCards: action.kittyCards, isKittyPhase: true }
          : {}),
      };

    case 'KITTY_FINISHED':
      return { ...state, isKittyPhase: false, kittyCards: [] };

    case 'TRICK_STARTED':
      return {
        ...state,
        trickPhase: true,
        currentTurn: action.leaderId,
        trickPlays: {},
        trickComplete: null,
        trickNum: action.trickNum,
        trickPlayerOrder: action.playerOrder,
        stagedCards: [],
        leaderCardCount: 0,
        log: [...state.log, { type: 'trick', trickNum: action.trickNum }],
      };

    case 'CARDS_PLAYED': {
      const newPlays = { ...state.trickPlays, [action.playerId]: action.cards };
      const newLeaderCount = state.leaderCardCount === 0 ? action.cards.length : state.leaderCardCount;
      const newHand = action.playerId === action.currentPlayerId
        ? state.handCards.filter(c => !action.cards.includes(c))
        : state.handCards;
      const playerName = state.players.find(p => p.player_id === action.playerId)?.display_name ?? action.playerId;
      return {
        ...state,
        trickPlays: newPlays,
        leaderCardCount: newLeaderCount,
        handCards: newHand,
        log: [...state.log, { type: 'play', playerName, cards: action.cards }],
      };
    }

    case 'TURN_ADVANCED':
      return { ...state, currentTurn: action.currentTurn };

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

    case 'THROW_FAILED':
      return { ...state, throwError: action.message, stagedCards: [] };

    case 'CLEAR_THROW_ERROR':
      return { ...state, throwError: null };

    case 'ROUND_OVER': {
      const newRanks: Record<string, number> = {};
      for (const [pid, rc] of Object.entries(action.rankChanges)) {
        newRanks[pid] = rc.newRank;
      }
      return {
        ...state,
        trickPhase: false,
        currentTurn: null,
        trickPlays: {},
        roundResult: {
          attackingPoints: action.attackingPoints,
          defendingPoints: action.defendingPoints,
          rankChanges: action.rankChanges,
          nextKingId: action.nextKingId,
          winningTeam: action.winningTeam,
          kittyBonus: action.kittyBonus,
          gameOver: action.gameOver,
        },
        playerRanks: newRanks,
      };
    }

    case 'GAME_STARTED': {
      const ranks: Record<string, number> = {};
      for (const p of action.players) {
        ranks[p.player_id] = p.rank ?? 2;
      }
      return {
        ...state,
        gameId: action.gameId,
        players: action.players,
        kittySize: action.kittySize ?? state.kittySize,
        trumpNumber: action.trumpNumber,
        trumpSuit: action.trumpSuit,
        trumpDeclarerId: null,
        trumpIsPair: false,
        declaredJokerRank: null,
        roundKingId: action.roundKingId,
        kittyPickedUp: false,
        stagedCards: [],
        kittyCards: [],
        isKittyPhase: false,
        handCards: [],
        handInitialized: false,
        trickPhase: false,
        currentTurn: null,
        trickPlays: {},
        trickComplete: null,
        trickNum: 0,
        trickPlayerOrder: [],
        leaderCardCount: 0,
        playerPoints: {},
        roundResult: null,
        throwError: null,
        playerRanks: ranks,
        log: [],
      };
    }

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
      if (state.kittyCards.length >= state.kittySize) return state;
      return {
        ...state,
        handCards: state.handCards.filter(c => c !== action.card),
        kittyCards: [...state.kittyCards, action.card],
      };

    case 'FINISH_KITTY':
      return { ...state, isKittyPhase: false, kittyCards: [] };

    case 'PICK_UP_KITTY':
      return { ...state, kittyPickedUp: true };

    case 'INIT_HAND':
      return { ...state, handCards: action.hand, handInitialized: true };

    default:
      return state;
  }
}

// ── Component ─────────────────────────────────────────────────────────

function buildInitialState(locationState: any): GameState {
  const players: GamePlayer[] = locationState?.players ?? [];
  const ranks: Record<string, number> = {};
  for (const p of players) {
    ranks[p.player_id] = p.rank ?? 2;
  }
  return {
    players,
    gameId: locationState?.gameId ?? '',
    trumpNumber: locationState?.trumpNumber ?? '2',
    trumpSuit: locationState?.trumpSuit ?? 'NA',
    trumpDeclarerId: null,
    trumpIsPair: false,
    roundKingId: locationState?.roundKingId ?? null,
    kittyPickedUp: false,
    stagedCards: [],
    kittyCards: [],
    isKittyPhase: false,
    handCards: [],
    handInitialized: false,
    roundResult: null,
    playerRanks: ranks,
    kittySize: locationState?.kittySize ?? 8,
    declaredJokerRank: null,
    throwError: null,
    trickPhase: false,
    currentTurn: null,
    trickPlays: {},
    trickComplete: null,
    trickNum: 0,
    trickPlayerOrder: [],
    leaderCardCount: 0,
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
    roundKingId, kittyPickedUp, stagedCards, kittyCards, isKittyPhase,
    handCards, handInitialized, roundResult, playerRanks, kittySize,
    declaredJokerRank, throwError, trickPhase, currentTurn, trickPlays,
    trickComplete, trickNum, playerPoints, log,
  } = state;

  // Dealing animation state (kept as useState — mutated inside setInterval)
  const [globalDealTick, setGlobalDealTick] = useState(0);
  const [dealKey, setDealKey] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Find current player
  const currentSocketId = socket.id;
  const currentIndex = players.findIndex((p) => p.socket_id === currentSocketId);
  const currentPlayer = currentIndex >= 0 ? players[currentIndex] : null;
  const rawHand = currentPlayer?.hand ?? [];

  // Listen for events
  useEffect(() => {
    const onTrumpDeclared = (data: { trumpSuit: string; declarerId: string; isPair: boolean; roundKingId: string; jokerRank?: string }) => {
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
      dispatch({ type: 'THROW_FAILED', message: data.message });
      setTimeout(() => dispatch({ type: 'CLEAR_THROW_ERROR' }), 3000);
    };

    const onRoundOver = (data: {
      attackingPoints: number;
      defendingPoints: number;
      rankChanges: Record<string, { oldRank: number; newRank: number }>;
      nextKingId: string;
      winningTeam: 'attacking' | 'defending';
      kittyBonus: number;
      gameOver: boolean;
    }) => {
      dispatch({ type: 'ROUND_OVER', ...data });
    };

    const onGameStarted = (data: {
      gameId: string;
      players: GamePlayer[];
      trumpNumber: string;
      trumpSuit: string;
      roundKingId: string | null;
      roundNumber?: number;
      kittySize?: number;
    }) => {
      dispatch({ type: 'GAME_STARTED', ...data });
      setGlobalDealTick(0);
      setDealKey(prev => prev + 1);
    };

    socket.on('trump-declared', onTrumpDeclared);
    socket.on('kitty-picked-up', onKittyPickedUp);
    socket.on('kitty-finished', onKittyFinished);
    socket.on('trick-started', onTrickStarted);
    socket.on('cards-played', onCardsPlayed);
    socket.on('turn-advanced', onTurnAdvanced);
    socket.on('trick-complete', onTrickComplete);
    socket.on('play-error', onPlayError);
    socket.on('throw-failed', onThrowFailed);
    socket.on('round-over', onRoundOver);
    socket.on('game-started', onGameStarted);
    return () => {
      socket.off('trump-declared', onTrumpDeclared);
      socket.off('kitty-picked-up', onKittyPickedUp);
      socket.off('kitty-finished', onKittyFinished);
      socket.off('trick-started', onTrickStarted);
      socket.off('cards-played', onCardsPlayed);
      socket.off('turn-advanced', onTurnAdvanced);
      socket.off('trick-complete', onTrickComplete);
      socket.off('play-error', onPlayError);
      socket.off('throw-failed', onThrowFailed);
      socket.off('round-over', onRoundOver);
      socket.off('game-started', onGameStarted);
    };
  }, [socket, currentPlayer?.player_id]);

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

  // Dealing animation
  useEffect(() => {
    if (rawHand.length === 0) return;
    const totalTicks = rawHand.length * players.length;

    intervalRef.current = setInterval(() => {
      setGlobalDealTick((prev) => {
        const next = prev + 1;
        if (next >= totalTicks) {
          clearInterval(intervalRef.current!);
          intervalRef.current = null;
        }
        return next;
      });
    }, 500);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [rawHand.length, dealKey]);

  const isDealing = globalDealTick < rawHand.length * players.length;

  // Once dealing finishes, populate handCards as the mutable source of truth
  useEffect(() => {
    if (!isDealing && rawHand.length > 0 && !handInitialized) {
      dispatch({ type: 'INIT_HAND', hand: rawHand });
    }
  }, [isDealing, rawHand, handInitialized]);

  // Use handCards once populated (post-deal), otherwise use rawHand for dealing animation
  const myRevealedCount = cardsDealtForPlayer(currentIndex, globalDealTick, players.length, rawHand.length);
  const myHand = handInitialized
    ? sortHand(handCards, trumpNumber)
    : sortHand(rawHand.slice(0, myRevealedCount), trumpNumber);
  const displayHand = myHand;

  // Check if a card is declarable (trump number card or joker pair that can be clicked)
  function isDeclarable(card: string): boolean {
    if (kittyPickedUp) return false;

    const { suit, rank } = parseCard(card);

    // Jokers: declarable if player has a pair of the same joker
    // (can override even a pair declaration)
    if (suit === 'J') {
      if (trumpSuit === 'NT') return false; // already declared jokers, final
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
    if (!trickPhase) return false;
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
    if (isKittyPhase) {
      handleHandCardClickForKitty(card);
      return;
    }

    // Trick phase: toggle card in/out of staged
    if (trickPhase) {
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
  const isMyTurn = trickPhase && currentPlayer && currentTurn === currentPlayer.player_id && !trickComplete;
  const canPlayTrick = isMyTurn && stagedCards.length > 0;

  // Determine which play handler and canPlay to use
  const inTrickPhase = trickPhase && !isKittyPhase;
  const canPlay = inTrickPhase ? canPlayTrick : canPlayDeclaration;
  const handlePlay = inTrickPhase ? handlePlayTrick : handleDeclareTrump;

  // Show play button in declaration phase or trick phase
  const showPlayButton = stagedCards.length > 0;

  // Pick up kitty button logic
  const showPickUpKitty = !isDealing && !kittyPickedUp && trumpSuit !== 'NA' && !!currentPlayer && currentPlayer.player_id === roundKingId;
  const handlePickUpKitty = () => {
    dispatch({ type: 'PICK_UP_KITTY' });
    socket.emit('pick-up-kitty', { gameId });
  };

  // Build action buttons for HandDisplay
  const handButtons: { label: string; enabled: boolean; onClick: () => void }[] = [];
  if (showPickUpKitty) {
    handButtons.push({ label: 'Pick Up Kitty', enabled: true, onClick: handlePickUpKitty });
  }
  if (isKittyPhase) {
    handButtons.push({ label: 'Finish Kitty', enabled: kittyCards.length === kittySize, onClick: handleFinishKitty });
  } else if (showPlayButton) {
    handButtons.push({ label: inTrickPhase ? 'Play Cards' : 'Declare Trump', enabled: !!canPlay, onClick: handlePlay });
  }

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
            trickPhase={trickPhase}
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
            const declaredCards = isDeclarer && !kittyPickedUp
              ? trumpSuit === 'NT' && declaredJokerRank
                ? [`J${declaredJokerRank}-decl0`, `J${declaredJokerRank}-decl1`]
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
              isCurrentTurn={trickPhase && currentTurn === player.player_id}
              rank={playerRanks[player.player_id]}
              trumpSuit={trumpSuit}
              trumpNumber={trumpNumber}
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
        {isKittyPhase && (
          <div style={{ display: 'flex', justifyContent: 'center', paddingBottom: '0.75rem' }}>
          <KittyArea
            isKittyPhase={isKittyPhase}
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
          isKittyPhase={isKittyPhase}
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
      </div>
    </div>
  );
}
