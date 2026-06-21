import { useState, useReducer, useRef } from 'react';
import { EVENTS } from '../../../../shared/events';
import { useLocation, useNavigate } from 'react-router-dom';
import { useSocket } from '../../hooks/useSocket';
import { useGameSocket } from '../../hooks/useGameSocket';
import { useGameActions } from '../../hooks/useGameActions';
import { useGameLayout } from '../../hooks/useGameLayout';
import { useReconnectInit } from '../../hooks/useReconnectInit';
import { useReinforceCheck } from '../../hooks/useReinforceCheck';
import { gameReducer, buildInitialState } from './gameState';
import type { GamePlayer, RoundResult } from './gameState';
import PlayerSeat from '../../components/PlayerSeat/PlayerSeat';
import TrumpInfo from '../../components/TrumpInfo/TrumpInfo';
import KittyArea from '../../components/KittyArea/KittyArea';
import RoundOverModal from '../../components/RoundOverModal/RoundOverModal';
import PlayerDisconnectedModal from '../../components/PlayerDisconnectedModal/PlayerDisconnectedModal';
import HandDisplay from '../../components/HandDisplay/HandDisplay';
import GameLog from '../../components/GameLog/GameLog';
import PrimaryButton from '../../components/PrimaryButton/PrimaryButton';
import { sortHand } from '../../utils/cards';
import { cardsDealtForPlayer, buildSeatMap } from '../../utils/seats';
import { isMobile } from '../../utils/layout';
import { getDeclaredCards, calcAttackingPoints } from '../../utils/game';
import styles from './GamePage.module.css';

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

  const [globalDealTick, setGlobalDealTick] = useState(location.state?.initialDealTick ?? 0);
  const rawHandRef = useRef<string[]>([]);
  const globalDealTickRef = useRef(globalDealTick);
  globalDealTickRef.current = globalDealTick;

  const currentSocketId = socket.id;
  const currentIndex = players.findIndex((p) => p.socketId === currentSocketId);
  const currentPlayer = currentIndex >= 0 ? players[currentIndex] : null;
  const rawHand = currentPlayer?.hand ?? [];
  rawHandRef.current = rawHand;

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

  useReconnectInit({ locationState: location.state, dispatch, rawHandRef, currentPlayer });

  useReinforceCheck({
    canReinforce,
    reinforceCloseAtCardCount,
    handInitialized,
    currentIndex,
    globalDealTick,
    playerCount: players.length,
    rawHandLength: rawHand.length,
    dispatch,
  });

  if (players.length === 0) {
    return (
      <div className={styles.noGame}>
        <h2>No active game</h2>
        <PrimaryButton onClick={() => navigate('/')} size="small">Back to Home</PrimaryButton>
      </div>
    );
  }

  const seatMap = buildSeatMap(players.length, currentIndex);
  const isDealing = globalDealTick < rawHand.length * players.length;

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
    <div className={styles.gamePage}>
      <GameLog log={log} isVisible={logVisible} onToggle={setLogVisible} />
      <div className={styles.main}>
        <div className={styles.trumpRow}>
          <TrumpInfo
            trumpNumber={trumpNumber}
            trumpSuit={trumpSuit}
            trickPhase={phase === 'trick'}
            cardScale={cardScale}
            attackingPoints={calcAttackingPoints(players, roundKingId, playerPoints)}
          />
        </div>

        <div
          className={styles.seats}
          style={{ '--center-min-h': `${centerMinHeightRem.toFixed(2)}rem` } as React.CSSProperties}
        >
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

        <div className={styles.handArea}>
          {phase === 'kitty' && (
            <div className={styles.kittyRow}>
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

        {throwError && <div className="overlay-toast overlay-toast--error">{throwError}</div>}
        {trickComplete && <div className="overlay-toast overlay-toast--trick">{trickComplete.winnerName} wins the trick!</div>}
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
