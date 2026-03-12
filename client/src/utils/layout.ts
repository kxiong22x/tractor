const REM = 16; // px per rem

export function isMobile(width: number, height: number): boolean {
  return width < 768 || height < 500;
}

// Returns how many cards fit in a row given available container width (in px).
// cardWidthRem: full card width in rem
// overlapRem: negative margin (overlap) between cards in rem
export function calcHandRowSize(availableWidthPx: number, cardWidthRem: number, overlapRem: number): number {
  const cardPx = cardWidthRem * REM;
  const overlapPx = overlapRem * REM;
  const effectiveWidthPerCard = cardPx - overlapPx;
  const count = Math.floor((availableWidthPx - cardPx) / effectiveWidthPerCard) + 1;
  return Math.max(1, count);
}

// Returns a card scale factor (0.5–1.0) so all cards fit within the viewport.
// Height constraint: trump bar (~2.5rem) + center (~22.9*scale rem) + hand (~6.3*scale + 2rem) ≈ 4.5 + 29.2*scale rem
// Width constraint: ensure ≥8 cards fit per hand row: 4.5 + 7*(4.5–1.5) = 25.5rem at scale=1
export function calcCardScale(width: number, height: number, logVisible: boolean): number {
  const logWidthRem = logVisible ? 10 : 1;
  const availableWidth = width - (logWidthRem + 2.5) * REM;
  const heightScale = (height / REM - 4.5) / 29.2;
  const widthScale = availableWidth / (REM * 25.5);
  return Math.max(0.5, Math.min(1.25, Math.min(heightScale, widthScale)));
}
