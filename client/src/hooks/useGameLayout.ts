import { CARD_WIDTH_REM, CARD_HEIGHT_REM, MINI_SCALE } from '../utils/cards';
import { calcHandRowSize, calcCardScale } from '../utils/layout';
import useWindowSize from './useWindowSize';

interface GameLayout {
  cardScale: number;
  overlapRem: number;
  centerMinHeightRem: number;
  handRowSize: number;
}

export function useGameLayout(logVisible: boolean): GameLayout {
  const { width, height } = useWindowSize();
  const cardScale = calcCardScale(width, height, logVisible);
  const overlapRem = 1.5 * cardScale;
  // Min center height so gap between top/bottom player card areas = 1 mini card height
  // Derived from: (1 - 2*0.03)*H - 2*(nameTagH + 0.25 + miniCardH) = miniCardH
  const centerMinHeightRem = (
    3 * (CARD_HEIGHT_REM * MINI_SCALE * cardScale) +           // 3 mini card heights
    2 * (2 * 0.75 + 0.875 * 1.5 + 0.0625 + 0.6875 * 1.5 + 0.2) + // 2 name tags (2×padding + name + rank)
    0.5                                                         // gap
  ) / 0.94; // accounts for 3% top/bottom inset
  const handRowSize = calcHandRowSize(
    width - ((logVisible ? 10 : 1) + 2.5) * 16, // available px: subtract log panel + side padding
    CARD_WIDTH_REM * cardScale,                  // card width in rem
    overlapRem
  );

  return { cardScale, overlapRem, centerMinHeightRem, handRowSize };
}
