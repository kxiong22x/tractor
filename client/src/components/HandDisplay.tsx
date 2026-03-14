import Card from './Card';

interface HandDisplayProps {
  displayHand: string[];
  stagedCards: string[];
  isKittyPhase: boolean;
  isDeclarable: (card: string) => boolean;
  isClickableInTrickPhase: (card: string) => boolean;
  onCardClick: (card: string) => void;
  trumpSuit: string;
  trumpNumber: string;
  rowSize: number;
  cardScale: number;
  overlapRem: number;
}

export default function HandDisplay({ displayHand, stagedCards, isKittyPhase, isDeclarable, isClickableInTrickPhase, onCardClick, trumpSuit, trumpNumber, rowSize, cardScale, overlapRem }: HandDisplayProps) {

  const rows: string[][] = [];
  for (let i = 0; i < displayHand.length; i += rowSize) {
    rows.push(displayHand.slice(i, i + rowSize));
  }

  return (
    <div className="hand-display">
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
                  marginLeft: i === 0 ? '0' : `-${overlapRem}rem`,
                  marginTop: clickable || staged ? '-0.9375rem' : '0',
                  cursor: clickable ? 'pointer' : 'default',
                  transition: 'margin-top 0.2s',
                }}
                onClick={() => onCardClick(card)}
              >
                <Card card={card} faceUp={true} scale={cardScale} selected={staged} trumpSuit={trumpSuit} trumpNumber={trumpNumber} />
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
