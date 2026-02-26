import db from './db';
import { Player } from './types';
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

export function setPlayerDisconnected(socketId: string): Player | undefined {
  const player = db.prepare('SELECT * FROM players WHERE socket_id = ?').get(socketId) as Player | undefined;
  if (player) {
    db.prepare('UPDATE players SET socket_id = NULL WHERE player_id = ?').run(player.player_id);
  }
  return player;
}

export function setPlayerReconnected(playerId: string, newSocketId: string): Player | undefined {
  db.prepare('UPDATE players SET socket_id = ? WHERE player_id = ?').run(newSocketId, playerId);
  return db.prepare('SELECT * FROM players WHERE player_id = ?').get(playerId) as Player | undefined;
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

export function getPlayerById(playerId: string): Player | undefined {
  return db.prepare('SELECT * FROM players WHERE player_id = ?').get(playerId) as Player | undefined;
}

export function getPlayerRank(playerId: string): number {
  const result = db.prepare('SELECT rank FROM players WHERE player_id = ?').get(playerId) as { rank: number } | undefined;
  return result?.rank ?? 2;
}

export function updatePlayerHand(playerId: string, hand: string[]): void {
  db.prepare('UPDATE players SET hand = ? WHERE player_id = ?').run(JSON.stringify(hand), playerId);
}

export function addPointsToPlayer(playerId: string, points: number): void {
  db.prepare('UPDATE players SET round_points = round_points + ? WHERE player_id = ?').run(points, playerId);
}

export function resetRoundPoints(roomId: string): void {
  db.prepare('UPDATE players SET round_points = 0 WHERE room_id = ?').run(roomId);
}

export function updatePlayerRank(playerId: string, newRank: number): void {
  db.prepare('UPDATE players SET rank = ? WHERE player_id = ?').run(newRank, playerId);
}

export function getRoundPoints(roomId: string): Record<string, number> {
  const rows = db.prepare('SELECT player_id, round_points FROM players WHERE room_id = ?').all(roomId) as { player_id: string; round_points: number }[];
  const result: Record<string, number> = {};
  for (const row of rows) {
    result[row.player_id] = row.round_points;
  }
  return result;
}
