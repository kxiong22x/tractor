import { useRef } from 'react';
import { useScrollToBottom } from '../../hooks/useScrollToBottom';
import { parseCard, getDisplayRank, getSuitSymbol, isRed } from '../../utils/cards';
import styles from './GameLog.module.css';

export type LogEntry =
  | { type: 'trick'; trickNum: number }
  | { type: 'play'; playerName: string; cards: string[] }
  | { type: 'winner'; playerName: string }
  | { type: 'declare'; playerName: string; cards: string[] }
  | { type: 'undo'; playerName: string };

function CardSpan({ card }: { card: string }) {
  const { suit, rank } = parseCard(card);
  const text = `${getDisplayRank(suit, rank)}${getSuitSymbol(suit)}`;
  return <span className={isRed(suit, rank) ? styles.cardRed : undefined}>{text}</span>;
}

interface GameLogProps {
  log: LogEntry[];
  isVisible: boolean;
  onToggle: (visible: boolean) => void;
}

export default function GameLog({ log, isVisible, onToggle }: GameLogProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useScrollToBottom(bottomRef, [log], isVisible);

  return (
    <div className={styles.gameLog}>

      <div className={styles.panel} style={{ width: isVisible ? '10rem' : '0' }}>
        <div className={styles.header}>
          Log
          <button
            onClick={() => onToggle(false)}
            className={styles.closeBtn}
            aria-label="Collapse log"
          >
            ×
          </button>
        </div>
        <div className={styles.body}>
          {log.map((entry, i) => {
            if (entry.type === 'trick') {
              return (
                <div key={i}>
                  {i !== 0 && <hr className={styles.divider} />}
                  <div className={styles.entryMutedBold}>
                    Trick #{entry.trickNum}
                  </div>
                </div>
              );
            }
            if (entry.type === 'winner') {
              return (
                <div key={i} className={styles.entryMutedItalic}>
                  {entry.playerName} wins
                </div>
              );
            }
            if (entry.type === 'declare') {
              return (
                <div key={i}>
                  <span className={styles.entryMuted}>{entry.playerName}</span>
                  {' declared '}
                  {entry.cards.map((card, j) => (
                    <span key={j}>{j > 0 ? ' ' : ''}<CardSpan card={card} /></span>
                  ))}
                </div>
              );
            }
            if (entry.type === 'undo') {
              return (
                <div key={i} className={styles.entryMutedItalic}>
                  {entry.playerName} undid play
                </div>
              );
            }
            return (
              <div key={i}>
                <span className={styles.entryMuted}>{entry.playerName}</span>
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
        <div className={styles.tabWrapper}>
          <button
            onClick={() => onToggle(true)}
            className={styles.tab}
            aria-label="Expand log"
          >
            ›
          </button>
        </div>
      )}

    </div>
  );
}
