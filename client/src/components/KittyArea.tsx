import Card from './Card';

interface KittyAreaProps {
  isKittyPhase: boolean;
  kittyCards: string[];
  kittySize: number;
  onKittyCardClick: (card: string) => void;
  trumpSuit: string;
  trumpNumber: string;
}

export default function KittyArea({ isKittyPhase, kittyCards, kittySize, onKittyCardClick, trumpSuit, trumpNumber }: KittyAreaProps) {
  if (!isKittyPhase) return null;

  return (
    <div style={{ display: 'flex', gap: '0.25rem', justifyContent: 'center' }}>
      {kittyCards.map((card) => (
        <div
          key={card}
          className="hand-card"
          style={{ cursor: 'pointer' }}
          onClick={() => onKittyCardClick(card)}
        >
          <Card card={card} faceUp={true} trumpSuit={trumpSuit} trumpNumber={trumpNumber} />
        </div>
      ))}
    </div>
  );
}
