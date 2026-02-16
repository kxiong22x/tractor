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
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (room_id) REFERENCES rooms(room_id) ON DELETE CASCADE
  );
`);

// Migrations for existing DBs
const playerCols = db.prepare("PRAGMA table_info(players)").all() as { name: string }[];
if (!playerCols.some((c) => c.name === 'hand')) {
  db.exec('ALTER TABLE players ADD COLUMN hand TEXT');
}
if (!playerCols.some((c) => c.name === 'rank')) {
  db.exec('ALTER TABLE players ADD COLUMN rank INTEGER DEFAULT 2');
}

const gameCols = db.prepare("PRAGMA table_info(games)").all() as { name: string }[];
if (!gameCols.some((c) => c.name === 'round_king')) {
  db.exec("ALTER TABLE games ADD COLUMN round_king TEXT");
  db.exec("ALTER TABLE games ADD COLUMN trump_number TEXT DEFAULT '2'");
  db.exec("ALTER TABLE games ADD COLUMN trump_suit TEXT DEFAULT 'NA'");
  db.exec("ALTER TABLE games ADD COLUMN trump_declarer TEXT");
  db.exec("ALTER TABLE games ADD COLUMN trump_count INTEGER DEFAULT 0");
}

export default db;
