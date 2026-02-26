import Card from './Card';

interface ActionButton {
  label: string;
  enabled: boolean;
  onClick: () => void;
  color?: string;
}

interface HandDisplayProps {
  displayHand: string[];
  stagedCards: string[];
  isKittyPhase: boolean;
  isDeclarable: (card: string) => boolean;
  isClickableInTrickPhase: (card: string) => boolean;
  onCardClick: (card: string) => void;
  buttons: ActionButton[];
  trumpSuit: string;
  trumpNumber: string;
}

export default function HandDisplay({ displayHand, stagedCards, isKittyPhase, isDeclarable, isClickableInTrickPhase, onCardClick, buttons, trumpSuit, trumpNumber }: HandDisplayProps) {
  const ROW_SIZE = 25;
  const rows: string[][] = [];
  for (let i = 0; i < displayHand.length; i += ROW_SIZE) {
    rows.push(displayHand.slice(i, i + ROW_SIZE));
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '0.25rem',
        flexShrink: 0,
        width: '100%',
      }}
    >
      {/* Action buttons above the hand */}
      {buttons.map((btn) => (
        <button
          key={btn.label}
          onClick={btn.onClick}
          disabled={!btn.enabled}
          style={{
            padding: '0.5rem 1.5rem',
            fontSize: '0.9375rem',
            fontWeight: 'bold',
            backgroundColor: btn.enabled ? (btn.color ?? '#4CAF50') : '#888',
            color: 'white',
            border: 'none',
            borderRadius: '0.5rem',
            cursor: btn.enabled ? 'pointer' : 'not-allowed',
            opacity: btn.enabled ? 1 : 0.6,
          }}
        >
          {btn.label}
        </button>
      ))}

      {rows.map((rowCards, rowIdx) => (
        <div
          key={`hand-row-${rowIdx}`}
          style={{
            display: 'flex',
            justifyContent: 'center',
            paddingTop: rowIdx === 0 ? '1.25rem' : '0.5rem',
          }}
        >
          {rowCards.map((card, i) => {
            const declarable = isDeclarable(card);
            const trickClickable = isClickableInTrickPhase(card);
            const staged = stagedCards.includes(card);
            const clickable = isKittyPhase || declarable || trickClickable;
            return (
              <div
                key={`${card}-${rowIdx}-${i}`}
                className="hand-card"
                style={{
                  marginLeft: i === 0 ? '0' : '-1.75rem',
                  marginTop: clickable || staged ? '-0.9375rem' : '0',
                  cursor: clickable ? 'pointer' : 'default',
                  transition: 'margin-top 0.2s',
                }}
              onClick={() => onCardClick(card)}
            >
              <Card card={card} faceUp={true} selected={staged} trumpSuit={trumpSuit} trumpNumber={trumpNumber} />
            </div>
          );
        })}
        </div>
      ))}
    </div>
  );
}
