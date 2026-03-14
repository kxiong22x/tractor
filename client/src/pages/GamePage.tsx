import { useState, useEffect, useReducer, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useSocket } from '../hooks/useSocket';
import { useGameSocket } from '../hooks/useGameSocket';
import { useGameActions } from '../hooks/useGameActions';
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
import { cardsDealtForPlayer, getPositionOrder } from '../utils/seats';
import { isMobile, calcHandRowSize, calcCardScale } from '../utils/layout';
import { CARD_WIDTH_REM, CARD_HEIGHT_REM, MINI_SCALE } from '../utils/cards';
import useWindowSize from '../hooks/useWindowSize';

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
    canReinforce, reinforceCloseAtCardCount,
  } = state;

  const [roundResult, setRoundResult] = useState<RoundResult | null>(location.state?.roundResult ?? null);
  const [throwError, setThrowError] = useState<string | null>(null);
  const [disconnectedPlayerName, setDisconnectedPlayerName] = useState<string | null>(null);
  const [logVisible, setLogVisible] = useState(() => !isMobile(window.innerWidth, window.innerHeight));
  const { width, height } = useWindowSize();
  const cardScale = calcCardScale(width, height, logVisible);
  const overlapRem = 1.5 * cardScale;
  // Min center height so gap between top/bottom player card areas = 1 mini card height
  // Derived from: (1 - 2*0.03)*H - 2*(nameTagH + 0.25 + miniCardH) = miniCardH
  const centerMinHeightRem = (
    3 * (CARD_HEIGHT_REM * MINI_SCALE * cardScale) +          // 3 mini card heights
    2 * (2 * 0.75 + 0.875 * 1.5 + 0.0625 + 0.6875 * 1.5 + 0.2) + // 2 name tags (2×padding + name + rank)
    0.5                                                        // gap
  ) / 0.94; // accounts for 3% top/bottom inset
  const handRowSize = calcHandRowSize(
    width - ((logVisible ? 10 : 1) + 2.5) * 16, // available px: subtract log panel + side padding
    CARD_WIDTH_REM * cardScale,                  // card width in rem
    overlapRem
  );

  // Dealing animation state — driven by server deal-tick events
  const [globalDealTick, setGlobalDealTick] = useState(location.state?.initialDealTick ?? 0);
  const rawHandRef = useRef<string[]>([]);
  const globalDealTickRef = useRef(globalDealTick);
  globalDealTickRef.current = globalDealTick;

  // Find current player
  const currentSocketId = socket.id;
  const currentIndex = players.findIndex((p) => p.socket_id === currentSocketId);
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

  // On reconnect, the server navigates here with location.state pre-populated. useReducer can
  // restore most state synchronously, but the hand must be hydrated from rawHandRef because the
  // socket's player object (which holds the hand) isn't available until after mount.
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

  const { isDeclarable, isClickableInTrickPhase, handleKittyCardClick, handleCardClick, nameTagButtons } = useGameActions({
    state,
    dispatch,
    socket,
    myHand,
    currentPlayer,
  });

  return (
    <div style={{ width: '100vw', height: '100vh', display: 'flex', overflow: 'hidden', backgroundColor: '#faf2e4' }}>
      <GameLog log={log} isVisible={logVisible} onToggle={setLogVisible} />
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
            cardScale={cardScale}
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
        <div style={{ position: 'relative', flex: 1, minHeight: `min(${centerMinHeightRem.toFixed(2)}rem, 75vh)` }}>
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
              cardScale={cardScale}
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
