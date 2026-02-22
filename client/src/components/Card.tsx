import { parseCard, getDisplayRank, getSuitSymbol, isRed } from '../utils/cards';

interface CardProps {
  card: string;
  faceUp: boolean;
  size?: 'normal' | 'mini';
  selected?: boolean;
  trumpSuit?: string;
  trumpNumber?: string;
}

export default function Card({ card, faceUp, size = 'normal', selected = false, trumpSuit, trumpNumber }: CardProps) {
  const isMini = size === 'mini';
  const w = isMini ? '2.25rem' : '3.75rem';
  const h = isMini ? '3.15rem' : '5.25rem';
  const radius = isMini ? '0.25rem' : '0.375rem';
  const showTrumpMarker = (() => {
    if (!faceUp) return false;
    if (!trumpSuit || !trumpNumber) return false;
    const { suit, rank } = parseCard(card);
    if (suit === 'J') return true;
    if (rank === trumpNumber) return true;
    if (trumpSuit !== 'NA' && trumpSuit !== 'NT' && suit === trumpSuit) return true;
    return false;
  })();

  if (!faceUp) {
    return (
      <div
        style={{
          width: w,
          height: h,
          borderRadius: radius,
          border: `${isMini ? 1 : 2}px solid #1a2744`,
          background: 'repeating-linear-gradient(45deg, #1b2a4a, #1b2a4a 0.1875rem, #243560 0.1875rem, #243560 0.375rem)',
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
          overflow: 'visible',
          backgroundColor: selected ? '#ccc' : 'white',
          opacity: selected ? 0.8 : 1,
        }}
      >
        {showTrumpMarker && (
          <div
            style={{
              position: 'absolute',
              top: '-0.375rem',
              left: '50%',
              transform: 'translateX(-50%)',
              fontSize: isMini ? '0.5rem' : '0.6875rem',
              fontWeight: 'bold',
              color: '#b71c1c',
              backgroundColor: 'rgba(255,255,255,0.9)',
              padding: isMini ? '0 0.1875rem' : '0 0.25rem',
              borderRadius: '0.25rem',
              border: '1px solid rgba(183,28,28,0.4)',
              lineHeight: 1.1,
            }}
          >
            T
          </div>
        )}
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
          backgroundColor: selected ? '#ccc' : 'white',
          borderRadius: radius,
          border: '1px solid #ccc',
          boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
          color,
          fontWeight: 'bold',
          userSelect: 'none',
          overflow: 'visible',
          opacity: selected ? 0.8 : 1,
        }}
      >
        {showTrumpMarker && (
          <div
            style={{
              position: 'absolute',
              top: '-0.375rem',
              left: '50%',
              transform: 'translateX(-50%)',
              fontSize: '0.5rem',
              fontWeight: 'bold',
              color: '#b71c1c',
              backgroundColor: 'rgba(255,255,255,0.9)',
              padding: '0 0.1875rem',
              borderRadius: '0.25rem',
              border: '1px solid rgba(183,28,28,0.4)',
              lineHeight: 1.1,
            }}
          >
            T
          </div>
        )}
        {/* Top-left rank + suit */}
        <div
          style={{
            position: 'absolute',
            top: '0.0625rem',
            left: '0.125rem',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            lineHeight: 1,
          }}
        >
          <span style={{ fontSize: '0.4375rem' }}>{displayRank}</span>
          <span style={{ fontSize: '0.4375rem' }}>{suitSymbol}</span>
        </div>
        {/* Center suit */}
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            fontSize: '0.875rem',
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
        backgroundColor: selected ? '#ccc' : 'white',
        borderRadius: radius,
        border: '2px solid #ccc',
        boxShadow: '0 2px 6px rgba(0,0,0,0.18)',
        color,
        fontWeight: 'bold',
        userSelect: 'none',
        overflow: 'visible',
        opacity: selected ? 0.8 : 1,
      }}
    >
      {showTrumpMarker && (
        <div
          style={{
            position: 'absolute',
            top: '-0.5rem',
            left: '50%',
            transform: 'translateX(-50%)',
            fontSize: '0.6875rem',
            fontWeight: 'bold',
            color: '#b71c1c',
            backgroundColor: 'rgba(255,255,255,0.9)',
            padding: '0 0.25rem',
            borderRadius: '0.25rem',
            border: '1px solid rgba(183,28,28,0.4)',
            lineHeight: 1.1,
          }}
        >
          T
        </div>
      )}
      {/* Top-left corner: rank + suit */}
      <div
        style={{
          position: 'absolute',
          top: '0.1875rem',
          left: '0.25rem',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          lineHeight: 1,
        }}
      >
        <span style={{ fontSize: '0.625rem' }}>{displayRank}</span>
        <span style={{ fontSize: '0.625rem' }}>{suitSymbol}</span>
      </div>
      {/* Center suit symbol */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          fontSize: '1.375rem',
          lineHeight: 1,
        }}
      >
        {suitSymbol}
      </div>
      {/* Bottom-right corner: rank + suit rotated 180° */}
      <div
        style={{
          position: 'absolute',
          bottom: '0.1875rem',
          right: '0.25rem',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          lineHeight: 1,
          transform: 'rotate(180deg)',
        }}
      >
        <span style={{ fontSize: '0.625rem' }}>{displayRank}</span>
        <span style={{ fontSize: '0.625rem' }}>{suitSymbol}</span>
      </div>
    </div>
  );
}
