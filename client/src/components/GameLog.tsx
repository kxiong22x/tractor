import { useRef, useEffect, useState } from 'react';
import { type LogEntry, CardSpan } from '../utils/log';
export type { LogEntry };

interface GameLogProps {
  log: LogEntry[];
  isVisible: boolean;
  onToggle: (visible: boolean) => void;
}

export default function GameLog({ log, isVisible, onToggle }: GameLogProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const [tabHovered, setTabHovered] = useState(false);

  useEffect(() => {
    if (isVisible) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [log, isVisible]);

  return (
    <div style={{ display: 'flex', flexShrink: 0, height: '100vh' }}>

      <div style={{
        width: isVisible ? '10rem' : '0',
        overflow: 'hidden',
        transition: 'width 250ms ease',
        height: '100vh',
        backgroundColor: '#f6f6f6',
        color: '#222',
        fontFamily: 'monospace',
        fontSize: '0.7rem',
        display: 'flex',
        flexDirection: 'column',
        boxSizing: 'border-box',
        flexShrink: 0,
      }}>
        <div style={{
          fontWeight: 'bold', fontSize: '0.8rem',
          borderBottom: '1px solid #ccc',
          padding: '0.5rem 0.4rem 0.25rem',
          flexShrink: 0,
          whiteSpace: 'nowrap',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          Log
          <button
            onClick={() => onToggle(false)}
            style={{
              background: 'none',
              border: 'none',
              outline: 'none',
              cursor: 'pointer',
              color: '#888',
              fontSize: '0.9rem',
              padding: '0 0 0 0.25rem',
              lineHeight: 1,
            }}
            aria-label="Collapse log"
          >
            ×
          </button>
        </div>
        <div style={{ overflowY: 'auto', flex: 1, minHeight: 0, padding: '0.25rem 0.4rem' }}>
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
            if (entry.type === 'declare') {
              return (
                <div key={i}>
                  <span style={{ color: '#5f5f5f' }}>{entry.playerName}</span>
                  {' declared '}
                  {entry.cards.map((card, j) => (
                    <span key={j}>{j > 0 ? ' ' : ''}<CardSpan card={card} /></span>
                  ))}
                </div>
              );
            }
            if (entry.type === 'undo') {
              return (
                <div key={i} style={{ color: '#5f5f5f', fontStyle: 'italic' }}>
                  {entry.playerName} undid play
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

      {!isVisible && (
        <div style={{ width: '1rem', flexShrink: 0, height: '100vh', display: 'flex', alignItems: 'flex-start', justifyContent: 'center' }}>
          <button
            onClick={() => onToggle(true)}
            onMouseEnter={() => setTabHovered(true)}
            onMouseLeave={() => setTabHovered(false)}
            style={{
              width: '1rem',
              height: '2rem',
              backgroundColor: tabHovered ? '#d0d0d0' : '#e8e8e8',
              border: '1px solid #ccc',
              outline: 'none',
              borderRadius: '0 4px 4px 0',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.7rem',
              color: '#666',
              padding: 0,
              fontFamily: 'monospace',
            }}
            aria-label="Expand log"
          >
            ›
          </button>
        </div>
      )}

    </div>
  );
}
