import { useRef, useEffect } from 'react';
import { parseCard, getDisplayRank, getSuitSymbol, isRed } from '../utils/cards';

export type LogEntry =
  | { type: 'trick'; trickNum: number }
  | { type: 'play'; playerName: string; cards: string[] }
  | { type: 'winner'; playerName: string }
  | { type: 'declare'; playerName: string; cards: string[] }
  | { type: 'undo'; playerName: string };

function CardSpan({ card }: { card: string }) {
  const { suit, rank } = parseCard(card);
  const text = `${getDisplayRank(suit, rank)}${getSuitSymbol(suit)}`;
  return <span style={isRed(suit, rank) ? { color: '#c00' } : undefined}>{text}</span>;
}

interface GameLogProps {
  log: LogEntry[];
  isVisible: boolean;
  onToggle: (visible: boolean) => void;
}

export default function GameLog({ log, isVisible, onToggle }: GameLogProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isVisible) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [log, isVisible]);

  return (
    <div className="game-log">

      <div className="game-log__panel" style={{ width: isVisible ? '10rem' : '0' }}>
        <div className="game-log__header">
          Log
          <button
            onClick={() => onToggle(false)}
            className="game-log__close-btn"
            aria-label="Collapse log"
          >
            ×
          </button>
        </div>
        <div className="game-log__body">
          {log.map((entry, i) => {
            if (entry.type === 'trick') {
              return (
                <div key={i}>
                  {i !== 0 && <hr className="game-log__divider" />}
                  <div className="game-log__entry--muted" style={{ fontWeight: 'bold' }}>
                    Trick #{entry.trickNum}
                  </div>
                </div>
              );
            }
            if (entry.type === 'winner') {
              return (
                <div key={i} className="game-log__entry--muted-italic">
                  {entry.playerName} wins
                </div>
              );
            }
            if (entry.type === 'declare') {
              return (
                <div key={i}>
                  <span className="game-log__entry--muted">{entry.playerName}</span>
                  {' declared '}
                  {entry.cards.map((card, j) => (
                    <span key={j}>{j > 0 ? ' ' : ''}<CardSpan card={card} /></span>
                  ))}
                </div>
              );
            }
            if (entry.type === 'undo') {
              return (
                <div key={i} className="game-log__entry--muted-italic">
                  {entry.playerName} undid play
                </div>
              );
            }
            return (
              <div key={i}>
                <span className="game-log__entry--muted">{entry.playerName}</span>
                {': '}
                {entry.cards.map((card, j) => (
                  <span key={j}>{j > 0 ? ' ' : ''}<CardSpan card={card} /></span>
                ))}
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>
      </div>

      {!isVisible && (
        <div className="game-log__tab-wrapper">
          <button
            onClick={() => onToggle(true)}
            className="game-log__tab"
            aria-label="Expand log"
          >
            ›
          </button>
        </div>
      )}

    </div>
  );
}
