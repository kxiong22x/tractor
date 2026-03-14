import Card from './Card';

interface KittyAreaProps {
  isKittyPhase: boolean;
  kittyCards: string[];
  onKittyCardClick: (card: string) => void;
  trumpSuit: string;
  trumpNumber: string;
  cardScale?: number;
}

export default function KittyArea({ isKittyPhase, kittyCards, onKittyCardClick, trumpSuit, trumpNumber, cardScale = 1 }: KittyAreaProps) {
  if (!isKittyPhase) return null;

  return (
    <div className="kitty-area">
      {kittyCards.map((card) => (
        <div
          key={card}
          className="hand-card"
          style={{ cursor: 'pointer' }}
          onClick={() => onKittyCardClick(card)}
        >
          <Card card={card} faceUp={true} scale={cardScale} trumpSuit={trumpSuit} trumpNumber={trumpNumber} />
        </div>
      ))}
    </div>
  );
}
