import type { GamePlayer } from '../pages/GamePage/gameState';

export function getDeclaredCards(
  playerDecl: { suit: string; count: number } | undefined,
  trumpNumber: string
): string[] | undefined {
  if (!playerDecl) return undefined;
  if (playerDecl.suit === 'BJ' || playerDecl.suit === 'SJ') {
    return [`J${playerDecl.suit[0]}-decl0`, `J${playerDecl.suit[0]}-decl1`];
  }
  if (playerDecl.count === 2) {
    return [`${playerDecl.suit}${trumpNumber}-decl0`, `${playerDecl.suit}${trumpNumber}-decl1`];
  }
  return [`${playerDecl.suit}${trumpNumber}-decl0`];
}

export function calcAttackingPoints(
  players: GamePlayer[],
  roundKingId: string | null,
  playerPoints: Record<string, number>
): number {
  if (!roundKingId) return 0;
  const kingIdx = players.findIndex(p => p.playerId === roundKingId);
  if (kingIdx < 0) return 0;
  let total = 0;
  for (let offset = 1; offset < players.length; offset += 2) {
    total += playerPoints[players[(kingIdx + offset) % players.length].playerId] ?? 0;
  }
  return total;
}
