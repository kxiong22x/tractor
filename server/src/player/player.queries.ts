import db from '../db';
import { Player } from '../types';
import { v4 as uuidv4 } from 'uuid';

export function addPlayer(roomId: string, displayName: string, socketId: string): Player {
  const playerId = uuidv4();

  const stmt = db.prepare(
    'INSERT INTO players (player_id, display_name, room_id, socket_id) VALUES (?, ?, ?, ?)'
  );
  stmt.run(playerId, displayName, roomId, socketId);

  return db.prepare('SELECT * FROM players WHERE player_id = ?').get(playerId) as Player;
}

export function removePlayer(playerId: string): void {
  db.prepare('DELETE FROM players WHERE player_id = ?').run(playerId);
}

export function removePlayerBySocketId(socketId: string): Player | undefined {
  const player = db.prepare('SELECT * FROM players WHERE socket_id = ?').get(socketId) as Player | undefined;
  if (player) {
    db.prepare('DELETE FROM players WHERE socket_id = ?').run(socketId);
  }
  return player;
}

export function getPlayersInRoom(roomId: string): Player[] {
  return db.prepare('SELECT * FROM players WHERE room_id = ? ORDER BY joined_at').all(roomId) as Player[];
}

export function getPlayerCountInRoom(roomId: string): number {
  const result = db.prepare('SELECT COUNT(*) as count FROM players WHERE room_id = ?').get(roomId) as { count: number };
  return result.count;
}

export function getPlayerBySocketId(socketId: string): Player | undefined {
  return db.prepare('SELECT * FROM players WHERE socket_id = ?').get(socketId) as Player | undefined;
}

export function getPlayerRank(playerId: string): number {
  const result = db.prepare('SELECT rank FROM players WHERE player_id = ?').get(playerId) as { rank: number } | undefined;
  return result?.rank ?? 2;
}
