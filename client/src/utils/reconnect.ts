const KEY = 'tractorPlayerId';

export function savePlayerId(playerId: string): void {
  localStorage.setItem(KEY, playerId);
}

export function getStoredPlayerId(): string | null {
  return localStorage.getItem(KEY);
}

export function clearStoredPlayerId(): void {
  localStorage.removeItem(KEY);
}
