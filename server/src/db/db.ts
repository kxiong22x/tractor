import Database from 'better-sqlite3';
import path from 'path';

const db = new Database(path.join(__dirname, '..', 'tractor.db'));

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS rooms (
    room_id TEXT PRIMARY KEY,
    url TEXT NOT NULL UNIQUE,
    creation_time TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS players (
    player_id TEXT PRIMARY KEY,
    display_name TEXT NOT NULL,
    room_id TEXT NOT NULL,
    socket_id TEXT,
    hand TEXT,
    rank INTEGER DEFAULT 2,
    round_points INTEGER DEFAULT 0,
    joined_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (room_id) REFERENCES rooms(room_id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS games (
    game_id TEXT PRIMARY KEY,
    room_id TEXT NOT NULL,
    kitty TEXT NOT NULL,
    round_king TEXT,
    trump_number TEXT DEFAULT '2',
    trump_suit TEXT DEFAULT 'NA',
    trump_declarer TEXT,
    trump_count INTEGER DEFAULT 0,
    round_number INTEGER DEFAULT 1,
    phase TEXT DEFAULT 'dealing',
    king_from_declaration INTEGER DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (room_id) REFERENCES rooms(room_id) ON DELETE CASCADE
  );
`);

export default db;
