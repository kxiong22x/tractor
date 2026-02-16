import db from '../db';
import { Game } from '../types';
import { v4 as uuidv4 } from 'uuid';

export function createGame(roomId: string, kitty: string[], roundKing: string | null, trumpNumber: string): Game {
  const gameId = uuidv4();
  const kittyJson = JSON.stringify(kitty);

  db.prepare(
    'INSERT INTO games (game_id, room_id, kitty, round_king, trump_number, trump_suit, trump_declarer, trump_count) VALUES (?, ?, ?, ?, ?, ?, NULL, 0)'
  ).run(gameId, roomId, kittyJson, roundKing, trumpNumber, 'NA');

  return db.prepare('SELECT * FROM games WHERE game_id = ?').get(gameId) as Game;
}

export function getGame(gameId: string): Game | undefined {
  return db.prepare('SELECT * FROM games WHERE game_id = ?').get(gameId) as Game | undefined;
}

export function getGameByRoomId(roomId: string): Game | undefined {
  return db.prepare('SELECT * FROM games WHERE room_id = ? ORDER BY created_at DESC LIMIT 1').get(roomId) as Game | undefined;
}

export function updateTrumpDeclaration(gameId: string, trumpSuit: string, declarerId: string, count: number): void {
  db.prepare(
    'UPDATE games SET trump_suit = ?, trump_declarer = ?, trump_count = ? WHERE game_id = ?'
  ).run(trumpSuit, declarerId, count, gameId);
}

export function updateRoundKing(gameId: string, playerId: string): void {
  db.prepare('UPDATE games SET round_king = ? WHERE game_id = ?').run(playerId, gameId);
}

export function updateKitty(gameId: string, kitty: string[]): void {
  db.prepare('UPDATE games SET kitty = ? WHERE game_id = ?').run(JSON.stringify(kitty), gameId);
}

export function updatePlayerHand(playerId: string, hand: string[]): void {
  db.prepare('UPDATE players SET hand = ? WHERE player_id = ?').run(JSON.stringify(hand), playerId);
}
