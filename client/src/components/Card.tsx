import { parseCard, getDisplayRank, getSuitSymbol, isRed, SMALL_SCALE, MINI_SCALE } from '../utils/cards';

interface CardProps {
  card: string;
  faceUp: boolean;
  size?: 'normal' | 'mini' | 'small';
  selected?: boolean;
  trumpSuit?: string;
  trumpNumber?: string;
}

export default function Card({ card, faceUp, size = 'normal', selected = false, trumpSuit, trumpNumber }: CardProps) {
  const sizeMultiplier = size === 'mini' ? MINI_SCALE : size === 'small' ? SMALL_SCALE : 1;
  const w = `${3.75 * sizeMultiplier}rem`;
  const h = `${5.25 * sizeMultiplier}rem`;
  const radius = `${0.375 * sizeMultiplier}rem`;
  const borderPx = size === 'normal' ? 2 : 1;

  const showTrumpMarker = (() => {
    if (!faceUp) return false;
    if (!trumpSuit || !trumpNumber) return false;
    const { suit, rank } = parseCard(card);
    if (suit === 'J') return true;
    if (rank === trumpNumber) return true;
    if (trumpSuit !== 'NA' && trumpSuit !== 'BJ' && trumpSuit !== 'SJ' && suit === trumpSuit) return true;
    return false;
  })();

  if (!faceUp) {
    return (
      <div
        style={{
          width: w,
          height: h,
          borderRadius: radius,
          border: `${borderPx}px solid #1a2744`,
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
    const src = `${import.meta.env.BASE_URL}${rank === 'B' ? 'red_joker.png' : 'black_joker.png'}`;
    return (
      <div
        style={{
          position: 'relative',
          width: w,
          height: h,
          borderRadius: radius,
          border: `${borderPx}px solid #ccc`,
          boxShadow: `0 ${2 * sizeMultiplier}px ${6 * sizeMultiplier}px rgba(0,0,0,0.18)`,
          overflow: 'visible',
          backgroundColor: selected ? '#ccc' : 'white',
          opacity: selected ? 0.8 : 1,
        }}
      >
        {showTrumpMarker && (
          <div
            style={{
              position: 'absolute',
              top: `-${0.375 * sizeMultiplier}rem`,
              left: '50%',
              transform: 'translateX(-50%)',
              fontSize: `${0.6875 * sizeMultiplier}rem`,
              fontWeight: 'bold',
              color: '#b71c1c',
              backgroundColor: 'rgba(255,255,255,0.9)',
              padding: `0 ${0.25 * sizeMultiplier}rem`,
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

  return (
    <div
      style={{
        position: 'relative',
        width: w,
        height: h,
        backgroundColor: selected ? '#ccc' : 'white',
        borderRadius: radius,
        border: `${borderPx}px solid #ccc`,
        boxShadow: `0 ${2 * sizeMultiplier}px ${6 * sizeMultiplier}px rgba(0,0,0,0.18)`,
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
            top: `-${0.5 * sizeMultiplier}rem`,
            left: '50%',
            transform: 'translateX(-50%)',
            fontSize: `${0.6875 * sizeMultiplier}rem`,
            fontWeight: 'bold',
            color: '#b71c1c',
            backgroundColor: 'rgba(255,255,255,0.9)',
            padding: `0 ${0.25 * sizeMultiplier}rem`,
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
          top: `${0.1875 * sizeMultiplier}rem`,
          left: `${0.25 * sizeMultiplier}rem`,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          lineHeight: 1,
        }}
      >
        <span style={{ fontSize: `${0.625 * sizeMultiplier}rem` }}>{displayRank}</span>
        <span style={{ fontSize: `${0.625 * sizeMultiplier}rem` }}>{suitSymbol}</span>
      </div>
      {/* Center suit symbol */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          fontSize: `${1.375 * sizeMultiplier}rem`,
          lineHeight: 1,
        }}
      >
        {suitSymbol}
      </div>
      {/* Bottom-right corner: rank + suit rotated 180° (omitted on mini) */}
      {size !== 'mini' && (
        <div
          style={{
            position: 'absolute',
            bottom: `${0.1875 * sizeMultiplier}rem`,
            right: `${0.25 * sizeMultiplier}rem`,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            lineHeight: 1,
            transform: 'rotate(180deg)',
          }}
        >
          <span style={{ fontSize: `${0.625 * sizeMultiplier}rem` }}>{displayRank}</span>
          <span style={{ fontSize: `${0.625 * sizeMultiplier}rem` }}>{suitSymbol}</span>
        </div>
      )}
    </div>
  );
}
