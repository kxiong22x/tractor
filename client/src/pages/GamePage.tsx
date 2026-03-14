import { useState, useEffect, useReducer, useRef } from 'react';
import { EVENTS } from '../../../shared/events';
import { useLocation, useNavigate } from 'react-router-dom';
import { useSocket } from '../hooks/useSocket';
import { useGameSocket } from '../hooks/useGameSocket';
import { useGameActions } from '../hooks/useGameActions';
import { useGameLayout } from '../hooks/useGameLayout';
import { useReconnectInit } from '../hooks/useReconnectInit';
import { gameReducer, buildInitialState } from '../gameState';
import type { GamePlayer, RoundResult } from '../gameState';
import PlayerSeat from '../components/PlayerSeat';
import TrumpInfo from '../components/TrumpInfo';
import KittyArea from '../components/KittyArea';
import RoundOverModal from '../components/RoundOverModal';
import PlayerDisconnectedModal from '../components/PlayerDisconnectedModal';
import ThrowError from '../components/ThrowError';
import TrickCompleteOverlay from '../components/TrickCompleteOverlay';
import HandDisplay from '../components/HandDisplay';
import GameLog from '../components/GameLog';
import { sortHand } from '../utils/cards';
import { cardsDealtForPlayer, buildSeatMap } from '../utils/seats';
import { isMobile } from '../utils/layout';

function getDeclaredCards(
  playerDecl: { suit: string; count: number } | undefined,
  trumpNumber: string
): string[] | undefined {
  if (!playerDecl) return undefined;
  if (playerDecl.suit === 'BJ' || playerDecl.suit === 'SJ') {
    return [`J${playerDecl.suit[0]}-decl0`, `J${playerDecl.suit[0]}-decl1`];
  }
  if (playerDecl.count === 2) {
    return [`${playerDecl.suit}${trumpNumber}-decl0`, `${playerDecl.suit}${trumpNumber}-decl1`];
  }
  return [`${playerDecl.suit}${trumpNumber}-decl0`];
}

function calcAttackingPoints(
  players: GamePlayer[],
  roundKingId: string | null,
  playerPoints: Record<string, number>
): number {
  if (!roundKingId) return 0;
  const kingIdx = players.findIndex(p => p.playerId === roundKingId);
  if (kingIdx < 0) return 0;
  let total = 0;
  for (let offset = 1; offset < players.length; offset += 2) {
    total += playerPoints[players[(kingIdx + offset) % players.length].playerId] ?? 0;
  }
  return total;
}

export default function GamePage() {
  const location = useLocation();
  const navigate = useNavigate();
  const socket = useSocket();

  const [state, dispatch] = useReducer(gameReducer, location.state, buildInitialState);
  const {
    players, gameId, trumpNumber, trumpSuit, declarationHistory,
    roundKingId, kittyPickedUp, stagedCards, kittyCards, phase,
    handCards, handInitialized,
    currentTurn, trickPlays,
    trickComplete, playerPoints, log,
    canReinforce, reinforceCloseAtCardCount,
  } = state;

  const [roundResult, setRoundResult] = useState<RoundResult | null>(location.state?.roundResult ?? null);
  const [throwError, setThrowError] = useState<string | null>(null);
  const [disconnectedPlayerName, setDisconnectedPlayerName] = useState<string | null>(null);
  const [logVisible, setLogVisible] = useState(() => !isMobile(window.innerWidth, window.innerHeight));
  const { cardScale, overlapRem, centerMinHeightRem, handRowSize } = useGameLayout(logVisible);

  // Dealing animation state — driven by server deal-tick events
  const [globalDealTick, setGlobalDealTick] = useState(location.state?.initialDealTick ?? 0);
  const rawHandRef = useRef<string[]>([]);
  const globalDealTickRef = useRef(globalDealTick);
  globalDealTickRef.current = globalDealTick;

  // Find current player
  const currentSocketId = socket.id;
  const currentIndex = players.findIndex((p) => p.socketId === currentSocketId);
  const currentPlayer = currentIndex >= 0 ? players[currentIndex] : null;
  const rawHand = currentPlayer?.hand ?? [];
  rawHandRef.current = rawHand;

  // Listen for events
  useGameSocket({
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
  });

  // On reconnect, restore hand and game state from location.state.
  useReconnectInit({ locationState: location.state, dispatch, rawHandRef, currentPlayer });

  // Close reinforce window after 2 more cards are dealt to the player
  useEffect(() => {
    if (!canReinforce || reinforceCloseAtCardCount === null || handInitialized) return;
    const currentCount = cardsDealtForPlayer(currentIndex, globalDealTick, players.length, rawHand.length);
    if (currentCount >= reinforceCloseAtCardCount) {
      dispatch({ type: 'CLEAR_REINFORCE' });
      dispatch({ type: 'CLEAR_STAGED' });
    }
  }, [globalDealTick]);

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

  const seatMap = buildSeatMap(players.length, currentIndex);

  // Computed from server-driven globalDealTick — always consistent in the same render
  const isDealing = globalDealTick < rawHand.length * players.length;

  // Use handCards once populated (post-deal), otherwise use rawHand for dealing animation
  const myRevealedCount = cardsDealtForPlayer(currentIndex, globalDealTick, players.length, rawHand.length);
  const myHand = handInitialized
    ? sortHand(handCards, trumpNumber, trumpSuit)
    : sortHand(rawHand.slice(0, myRevealedCount), trumpNumber, trumpSuit);
  const displayHand = myHand;

  const { isDeclarable, isClickableInTrickPhase, handleKittyCardClick, handleCardClick, nameTagButtons } = useGameActions({
    state,
    dispatch,
    socket,
    myHand,
    currentPlayer,
  });

  return (
    <div className="game-page">
      <GameLog log={log} isVisible={logVisible} onToggle={setLogVisible} />
      <div className="game-page__main">
        {/* Row 1: Trump info */}
        <div style={{ width: '100%' }}>
          <TrumpInfo
            trumpNumber={trumpNumber}
            trumpSuit={trumpSuit}
            trickPhase={phase === 'trick'}
            cardScale={cardScale}
            attackingPoints={calcAttackingPoints(players, roundKingId, playerPoints)}
          />
        </div>

        {/* Row 2: Player seats */}
        <div className="game-page__seats" style={{ minHeight: `min(${centerMinHeightRem.toFixed(2)}rem, 75vh)` }}>
          {players.map((player, i) => {
            const playerDecl = !kittyPickedUp && phase === 'declaration'
              ? declarationHistory[player.playerId]
              : undefined;
            const declaredCards = getDeclaredCards(playerDecl, trumpNumber);
            return (
            <PlayerSeat
              key={player.playerId}
              player={player}
              position={seatMap[i]}
              isCurrentPlayer={player.socketId === currentSocketId}
              isRoundKing={player.playerId === roundKingId}
              declaredCards={declaredCards}
              isBeingDealt={isDealing && globalDealTick > 0 && (globalDealTick - 1) % players.length === i}
              playedCards={trickPlays[player.playerId]}
              isCurrentTurn={phase === 'trick' && currentTurn === player.playerId}
              rank={player.rank ?? 2}
              trumpSuit={trumpSuit}
              trumpNumber={trumpNumber}
              buttons={player.socketId === currentSocketId ? nameTagButtons : undefined}
              cardScale={cardScale}
            />
          );
        })}
      </div>

      {/* Row 3: Hand display — full width */}
      <div className="game-page__hand-area">
        {/* Kitty cards — above hand */}
        {phase === 'kitty' && (
          <div className="game-page__kitty-row">
          <KittyArea
            isKittyPhase={phase === 'kitty'}
            kittyCards={kittyCards}
            onKittyCardClick={handleKittyCardClick}
            trumpSuit={trumpSuit}
            trumpNumber={trumpNumber}
            cardScale={cardScale}
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
          trumpSuit={trumpSuit}
          trumpNumber={trumpNumber}
          rowSize={handRowSize}
          cardScale={cardScale}
          overlapRem={overlapRem}
        />
      </div>

        {/* Overlays */}
        {throwError && <ThrowError message={throwError} />}

        {trickComplete && <TrickCompleteOverlay winnerName={trickComplete.winnerName} />}

        {roundResult && (
          <RoundOverModal
            roundResult={roundResult}
            players={players}
            onNextRound={() => socket.emit(EVENTS.START_NEXT_ROUND, { gameId })}
          />
        )}

        {disconnectedPlayerName && (
          <PlayerDisconnectedModal playerName={disconnectedPlayerName} />
        )}
      </div>
    </div>
  );
}
