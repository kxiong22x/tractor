import { useRef, useEffect } from 'react';
import { type LogEntry } from '../utils/log';
import { parseCard, getDisplayRank, getSuitSymbol, isRed } from '../utils/cards';
export type { LogEntry };

function CardSpan({ card }: { card: string }) {
  const { suit, rank } = parseCard(card);
  const text = `${getDisplayRank(suit, rank)}${getSuitSymbol(suit)}`;
  return <span style={isRed(suit, rank) ? { color: '#c00' } : undefined}>{text}</span>;
}

interface GameLogProps {
  log: LogEntry[];
}

export default function GameLog({ log }: GameLogProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [log]);

  return (
    <div
      style={{
        width: '10rem',
        flexShrink: 0,
        height: '100vh',
        backgroundColor: '#f6f6f6',
        color: '#222',
        fontFamily: 'monospace',
        fontSize: '0.7rem',
        display: 'flex',
        flexDirection: 'column',
        boxSizing: 'border-box',
      }}
    >
      <div style={{ fontWeight: 'bold', fontSize: '0.8rem', borderBottom: '1px solid #ccc', padding: '0.5rem 0.4rem 0.25rem', flexShrink: 0 }}>Log</div>
      <div style={{ overflowY: 'auto', flex: 1, padding: '0.25rem 0.4rem' }}>
      {log.map((entry, i) => {
        if (entry.type === 'trick') {
          return (
            <div key={i}>
              {i !== 0 && <hr style={{ border: 'none', borderTop: '1px dashed #bbb', margin: '0.4rem 0' }} />}
              <div style={{ color: '#5f5f5f', fontWeight: 'bold' }}>
                Trick #{entry.trickNum}
              </div>
            </div>
          );
        }
        if (entry.type === 'winner') {
          return (
            <div key={i} style={{ color: '#5f5f5f', fontStyle: 'italic' }}>
              {entry.playerName} wins
            </div>
          );
        }
        return (
          <div key={i}>
            <span style={{ color: '#5f5f5f' }}>{entry.playerName}</span>
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
  );
}
