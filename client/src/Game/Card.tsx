interface CardProps {
  card: string;
  faceUp: boolean;
  size?: 'normal' | 'mini';
}

const SUIT_SYMBOLS: Record<string, string> = {
  S: '\u2660',
  H: '\u2665',
  D: '\u2666',
  C: '\u2663',
};

function parseCard(card: string): { suit: string; rank: string } {
  const [cardPart] = card.split('-');
  const suit = cardPart[0];
  const rank = cardPart.slice(1);
  return { suit, rank };
}

function getDisplayRank(suit: string, rank: string): string {
  if (suit === 'J') return rank === 'B' ? 'Big' : 'Sm';
  return rank;
}

function getSuitSymbol(suit: string): string {
  if (suit === 'J') return '\uD83C\uDCCF';
  return SUIT_SYMBOLS[suit] || '';
}

function isRed(suit: string, rank: string): boolean {
  if (suit === 'J') return rank === 'B';
  return suit === 'H' || suit === 'D';
}

export default function Card({ card, faceUp, size = 'normal' }: CardProps) {
  const isMini = size === 'mini';
  const w = isMini ? 30 : 60;
  const h = isMini ? 42 : 84;
  const radius = isMini ? 3 : 6;

  if (!faceUp) {
    return (
      <div
        style={{
          width: w,
          height: h,
          borderRadius: radius,
          border: `${isMini ? 1 : 2}px solid #1a2744`,
          background: 'repeating-linear-gradient(45deg, #1b2a4a, #1b2a4a 3px, #243560 3px, #243560 6px)',
          boxShadow: '0 2px 6px rgba(0,0,0,0.25)',
        }}
      />
    );
  }

  const { suit, rank } = parseCard(card);
  const color = isRed(suit, rank) ? '#d32f2f' : '#222';

  // Joker cards use full image
  if (suit === 'J') {
    const src = rank === 'B' ? '/red_joker.png' : '/black_joker.png';
    return (
      <div
        style={{
          position: 'relative',
          width: w,
          height: h,
          borderRadius: radius,
          border: `${isMini ? 1 : 2}px solid #ccc`,
          boxShadow: isMini ? '0 1px 3px rgba(0,0,0,0.15)' : '0 2px 6px rgba(0,0,0,0.18)',
          overflow: 'hidden',
          backgroundColor: 'white',
        }}
      >
        <img
          src={src}
          alt={rank === 'B' ? 'Big Joker' : 'Small Joker'}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      </div>
    );
  }

  const displayRank = getDisplayRank(suit, rank);
  const suitSymbol = getSuitSymbol(suit);

  if (isMini) {
    return (
      <div
        style={{
          position: 'relative',
          width: w,
          height: h,
          backgroundColor: 'white',
          borderRadius: radius,
          border: '1px solid #ccc',
          boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
          color,
          fontWeight: 'bold',
          userSelect: 'none',
          overflow: 'hidden',
        }}
      >
        {/* Top-left rank + suit */}
        <div
          style={{
            position: 'absolute',
            top: 1,
            left: 2,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            lineHeight: 1,
          }}
        >
          <span style={{ fontSize: 7 }}>{displayRank}</span>
          <span style={{ fontSize: 7 }}>{suitSymbol}</span>
        </div>
        {/* Center suit */}
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            fontSize: 14,
            lineHeight: 1,
          }}
        >
          {suitSymbol}
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        position: 'relative',
        width: w,
        height: h,
        backgroundColor: 'white',
        borderRadius: radius,
        border: '2px solid #ccc',
        boxShadow: '0 2px 6px rgba(0,0,0,0.18)',
        color,
        fontWeight: 'bold',
        userSelect: 'none',
        overflow: 'hidden',
      }}
    >
      {/* Top-left corner: rank + suit */}
      <div
        style={{
          position: 'absolute',
          top: 3,
          left: 4,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          lineHeight: 1,
        }}
      >
        <span style={{ fontSize: 10 }}>{displayRank}</span>
        <span style={{ fontSize: 10 }}>{suitSymbol}</span>
      </div>
      {/* Center suit symbol */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          fontSize: 22,
          lineHeight: 1,
        }}
      >
        {suitSymbol}
      </div>
      {/* Bottom-right corner: rank + suit rotated 180° */}
      <div
        style={{
          position: 'absolute',
          bottom: 3,
          right: 4,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          lineHeight: 1,
          transform: 'rotate(180deg)',
        }}
      >
        <span style={{ fontSize: 10 }}>{displayRank}</span>
        <span style={{ fontSize: 10 }}>{suitSymbol}</span>
      </div>
    </div>
  );
}
