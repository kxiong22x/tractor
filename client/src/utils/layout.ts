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
