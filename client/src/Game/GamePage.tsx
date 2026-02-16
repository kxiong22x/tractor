import { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useSocket } from '../hooks/useSocket';
import type { Player } from '../types';
import Card from './Card';
import PlayerSeat from './PlayerSeat';

interface GamePlayer extends Player {
  hand: string[];
}

const POSITION_ORDER: ('bottom' | 'left' | 'top' | 'right')[] = ['bottom', 'left', 'top', 'right'];

const SUIT_ORDER: Record<string, number> = { S: 0, H: 1, C: 2, D: 3, J: 4 };
const RANK_ORDER: Record<string, number> = {
  '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10,
  'J': 11, 'Q': 12, 'K': 13, 'A': 14, 'S': 15, 'B': 16,
};

const SUIT_SYMBOLS: Record<string, string> = {
  S: '\u2660', H: '\u2665', D: '\u2666', C: '\u2663',
};

function parseCard(card: string) {
  const [cardPart] = card.split('-');
  return { suit: cardPart[0], rank: cardPart.slice(1) };
}

function sortHand(cards: string[], trumpNum: string): string[] {
  function isTrumpGroup(suit: string, rank: string): boolean {
    return suit === 'J' || rank === trumpNum;
  }

  return [...cards].sort((a, b) => {
    const ca = parseCard(a);
    const cb = parseCard(b);
    const aTrump = isTrumpGroup(ca.suit, ca.rank);
    const bTrump = isTrumpGroup(cb.suit, cb.rank);

    // Trump group comes first
    if (aTrump && !bTrump) return -1;
    if (!aTrump && bTrump) return 1;

    if (aTrump && bTrump) {
      // Within trump group: jokers last (Big > Small), then by suit then rank
      const aJoker = ca.suit === 'J';
      const bJoker = cb.suit === 'J';
      if (aJoker && !bJoker) return 1;
      if (!aJoker && bJoker) return -1;
      if (aJoker && bJoker) return RANK_ORDER[ca.rank] - RANK_ORDER[cb.rank];
      // Both are trump-number cards: sort by suit
      const suitDiff = SUIT_ORDER[ca.suit] - SUIT_ORDER[cb.suit];
      if (suitDiff !== 0) return suitDiff;
      return 0;
    }

    // Non-trump: sort by suit then rank
    const suitDiff = SUIT_ORDER[ca.suit] - SUIT_ORDER[cb.suit];
    if (suitDiff !== 0) return suitDiff;
    return RANK_ORDER[ca.rank] - RANK_ORDER[cb.rank];
  });
}

function cardsDealtForPlayer(joinIndex: number, tick: number): number {
  if (tick <= joinIndex) return 0;
  return Math.min(25, Math.floor((tick - joinIndex - 1) / 4) + 1);
}

export default function GamePage() {
  const location = useLocation();
  const navigate = useNavigate();
  const socket = useSocket();

  const players: GamePlayer[] = location.state?.players ?? [];
  const gameId: string = location.state?.gameId ?? '';

  // Trump state
  const [trumpNumber, setTrumpNumber] = useState<string>(location.state?.trumpNumber ?? '2');
  const [trumpSuit, setTrumpSuit] = useState<string>(location.state?.trumpSuit ?? 'NA');
  const [trumpDeclarerId, setTrumpDeclarerId] = useState<string | null>(null);
  const [trumpIsPair, setTrumpIsPair] = useState(false);
  const [roundKingId, setRoundKingId] = useState<string | null>(location.state?.roundKingId ?? null);
  const [kittyPickedUp, setKittyPickedUp] = useState(false);
  const [stagedCards, setStagedCards] = useState<string[]>([]);
  const [kittyCards, setKittyCards] = useState<string[]>([]);
  const [isKittyPhase, setIsKittyPhase] = useState(false);
  const [handCards, setHandCards] = useState<string[]>([]);

  console.log('GamePage debug:', { socketId: socket.id, players: players.map(p => ({ name: p.display_name, socketId: p.socket_id, handLen: p.hand?.length })) });

  // Listen for trump-declared events
  useEffect(() => {
    const onTrumpDeclared = (data: { trumpSuit: string; declarerId: string; isPair: boolean; roundKingId: string }) => {
      setTrumpSuit(data.trumpSuit);
      setTrumpDeclarerId(data.declarerId);
      setTrumpIsPair(data.isPair);
      setRoundKingId(data.roundKingId);
      setStagedCards([]);
    };

    const onKittyPickedUp = (data: { kittyCards?: string[] }) => {
      setKittyPickedUp(true);
      if (data.kittyCards) {
        setKittyCards(data.kittyCards);
        setIsKittyPhase(true);
      }
    };

    const onKittyFinished = () => {
      setIsKittyPhase(false);
      setKittyCards([]);
    };

    socket.on('trump-declared', onTrumpDeclared);
    socket.on('kitty-picked-up', onKittyPickedUp);
    socket.on('kitty-finished', onKittyFinished);
    return () => {
      socket.off('trump-declared', onTrumpDeclared);
      socket.off('kitty-picked-up', onKittyPickedUp);
      socket.off('kitty-finished', onKittyFinished);
    };
  }, [socket]);

  if (players.length === 0) {
    return (
      <div style={{ textAlign: 'center', marginTop: '100px' }}>
        <h2>No active game</h2>
        <button onClick={() => navigate('/')} style={{ marginTop: '16px', padding: '8px 24px', cursor: 'pointer' }}>
          Back to Home
        </button>
      </div>
    );
  }

  // Find current player and arrange seating
  const currentSocketId = socket.id;
  const currentIndex = players.findIndex((p) => p.socket_id === currentSocketId);
  const seatMap = players.map((_, i) => {
    const rotated = (i - currentIndex + players.length) % players.length;
    return POSITION_ORDER[rotated];
  });

  // Get current player's hand
  const currentPlayer = currentIndex >= 0 ? players[currentIndex] : null;
  const rawHand = currentPlayer?.hand ?? [];

  // Dealing animation state — round-robin across all 4 players
  const [globalDealTick, setGlobalDealTick] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (rawHand.length === 0) return;
    const totalTicks = rawHand.length * 4; // 100

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
  }, [rawHand.length]);

  const isDealing = globalDealTick < rawHand.length * 4;

  // Once dealing finishes, populate handCards as the mutable source of truth
  useEffect(() => {
    if (!isDealing && rawHand.length > 0 && handCards.length === 0) {
      setHandCards(rawHand);
    }
  }, [isDealing, rawHand, handCards.length]);

  // Use handCards once populated (post-deal), otherwise use rawHand for dealing animation
  const myRevealedCount = cardsDealtForPlayer(currentIndex, globalDealTick);
  const myHand = handCards.length > 0
    ? sortHand(handCards, trumpNumber)
    : sortHand(rawHand.slice(0, myRevealedCount), trumpNumber);
  const displayHand = myHand.filter(c => !stagedCards.includes(c));

  // Check if a card is declarable (trump number card that can be clicked)
  function isDeclarable(card: string): boolean {
    if (kittyPickedUp) return false; // Declaration is final once kitty is picked up
    if (trumpIsPair) return false; // A pair declaration locks trump

    const { suit, rank } = parseCard(card);
    if (rank !== trumpNumber) return false;
    if (suit === 'J') return false; // Jokers can't be trump suit

    if (trumpSuit === 'NA') {
      // No declaration yet — any trump-number card is declarable
      return true;
    }

    // Single declaration exists
    if (currentPlayer) {
      const playerId = currentPlayer.player_id;

      // Count how many cards of this suit+rank the player has in revealed hand
      const sameCards = myHand.filter((c) => {
        const p = parseCard(c);
        return p.suit === suit && p.rank === trumpNumber;
      });

      if (playerId === trumpDeclarerId && suit === trumpSuit) {
        // Reinforcement: original declarer needs 2+ of declared suit
        return sameCards.length >= 2;
      } else {
        // Override: needs a pair (2+ of same suit)
        return sameCards.length >= 2;
      }
    }

    return false;
  }

  function handleKittyCardClick(card: string) {
    setKittyCards(prev => prev.filter(c => c !== card));
    setHandCards(prev => [...prev, card]);
  }

  function handleHandCardClickForKitty(card: string) {
    if (kittyCards.length >= 8) return;
    setHandCards(prev => prev.filter(c => c !== card));
    setKittyCards(prev => [...prev, card]);
  }

  function handleFinishKitty() {
    socket.emit('finish-kitty', { gameId, kittyCards, handCards });
    setIsKittyPhase(false);
    setKittyCards([]);
  }

  function handleCardClick(card: string) {
    if (isKittyPhase) {
      handleHandCardClickForKitty(card);
      return;
    }
    if (!isDeclarable(card)) return;
    if (stagedCards.length >= 2) return;
    setStagedCards(prev => [...prev, card]);
  }

  function handleStagedCardClick(card: string) {
    setStagedCards(prev => prev.filter(c => c !== card));
  }

  // A pair is required when overriding or reinforcing an existing declaration
  const pairRequired = trumpSuit !== 'NA';
  const canPlay = stagedCards.length > 0 && (!pairRequired || stagedCards.length >= 2);

  function handlePlayCard() {
    if (!canPlay) return;
    socket.emit('declare-trump', { gameId, card: stagedCards[0] });
    setStagedCards([]);
  }

  // Trump suit display
  const trumpSuitDisplay = trumpSuit === 'NA' ? 'NA' : (SUIT_SYMBOLS[trumpSuit] ?? trumpSuit);

  return (
    <div
      style={{
        position: 'relative',
        width: '100vw',
        height: '100vh',
        backgroundColor: '#faf2e4',
        overflow: 'hidden',
      }}
    >
      {/* Trump info display */}
      <div
        style={{
          position: 'absolute',
          top: '16px',
          left: '16px',
          backgroundColor: 'rgba(0, 0, 0, 0.6)',
          color: 'white',
          padding: '8px 14px',
          borderRadius: '8px',
          fontSize: '16px',
          fontWeight: 'bold',
          display: 'flex',
          gap: '12px',
          alignItems: 'center',
          zIndex: 10,
        }}
      >
        <span>Trump: {trumpNumber}</span>
        <span style={{ color: (trumpSuit === 'H' || trumpSuit === 'D') ? '#ff6b6b' : 'white' }}>
          {trumpSuitDisplay}
        </span>
      </div>

      {/* Player seats */}
      {players.map((player, i) => {
        const isDeclarer = trumpDeclarerId === player.player_id && trumpSuit !== 'NA';
        const declaredCards = isDeclarer && !kittyPickedUp
          ? trumpIsPair
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
            isBeingDealt={isDealing && globalDealTick > 0 && (globalDealTick - 1) % 4 === i}
          />
        );
      })}

      {/* Staging area — bottom left */}
      {stagedCards.length > 0 && (
        <div
          style={{
            position: 'absolute',
            bottom: '120px',
            left: '20px',
            zIndex: 10,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <div style={{ display: 'flex', gap: '4px' }}>
            {stagedCards.map((card) => (
              <div
                key={card}
                style={{ cursor: 'pointer' }}
                onClick={() => handleStagedCardClick(card)}
              >
                <Card card={card} faceUp={true} />
              </div>
            ))}
          </div>
          <button
            onClick={handlePlayCard}
            disabled={!canPlay}
            style={{
              padding: '8px 24px',
              fontSize: '15px',
              fontWeight: 'bold',
              backgroundColor: canPlay ? '#4CAF50' : '#888',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: canPlay ? 'pointer' : 'not-allowed',
              opacity: canPlay ? 1 : 0.6,
            }}
          >
            Play Card
          </button>
        </div>
      )}

      {/* Pick Up Kitty button — bottom left */}
      {!isDealing && !kittyPickedUp && trumpSuit !== 'NA' && currentPlayer && currentPlayer.player_id === roundKingId && (
        <div
          style={{
            position: 'absolute',
            bottom: '20px',
            left: '20px',
            zIndex: 10,
          }}
        >
          <button
            onClick={() => {
              setKittyPickedUp(true);
              socket.emit('pick-up-kitty', { gameId });
            }}
            style={{
              padding: '10px 28px',
              fontSize: '16px',
              fontWeight: 'bold',
              backgroundColor: '#4CAF50',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
            }}
          >
            Pick Up Kitty
          </button>
        </div>
      )}

      {/* Kitty phase — kitty cards in center of diamond */}
      {isKittyPhase && (
        <div
          style={{
            position: 'absolute',
            top: '35%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            display: 'flex',
            gap: '4px',
            zIndex: 20,
          }}
        >
          {kittyCards.map((card) => (
            <div
              key={card}
              className="hand-card"
              style={{ cursor: 'pointer' }}
              onClick={() => handleKittyCardClick(card)}
            >
              <Card card={card} faceUp={true} />
            </div>
          ))}
        </div>
      )}

      {/* Finish Kitty button — bottom-left, same position as Pick Up Kitty */}
      {isKittyPhase && kittyCards.length === 8 && (
        <div style={{ position: 'absolute', bottom: '20px', left: '20px', zIndex: 20 }}>
          <button
            onClick={handleFinishKitty}
            style={{
              padding: '10px 28px',
              fontSize: '16px',
              fontWeight: 'bold',
              backgroundColor: '#4CAF50',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
            }}
          >
            Finish Kitty
          </button>
        </div>
      )}

      {/* Current player's cards — two rows of up to 13, right-aligned */}
      <div
        style={{
          position: 'absolute',
          bottom: '20px',
          right: '20px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
          gap: '4px',
        }}
      >
        {(() => {
          const handRows: string[][] = [];
          for (let i = 0; i < displayHand.length; i += 13) {
            handRows.push(displayHand.slice(i, i + 13));
          }
          return handRows;
        })().map((row, rowIndex) => (
          <div key={rowIndex} style={{ display: 'flex' }}>
            {row.map((card, i) => {
              const declarable = isDeclarable(card);
              const clickable = isKittyPhase || declarable;
              return (
                <div
                  key={card}
                  className="hand-card"
                  style={{
                    marginLeft: i === 0 ? '0' : '-20px',
                    marginTop: clickable ? '-15px' : '0',
                    cursor: clickable ? 'pointer' : 'default',
                    transition: 'margin-top 0.2s',
                  }}
                  onClick={() => handleCardClick(card)}
                >
                  <Card card={card} faceUp={true} />
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
