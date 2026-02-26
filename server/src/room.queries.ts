import db from './db';
import { Room } from './types';
import { v4 as uuidv4 } from 'uuid';

export function createRoom(): Room {
  const roomId = uuidv4().slice(0, 8);
  const url = `/room/${roomId}`;

  const stmt = db.prepare('INSERT INTO rooms (room_id, url) VALUES (?, ?)');
  stmt.run(roomId, url);

  return db.prepare('SELECT * FROM rooms WHERE room_id = ?').get(roomId) as Room;
}

export function getRoom(roomId: string): Room | undefined {
  return db.prepare('SELECT * FROM rooms WHERE room_id = ?').get(roomId) as Room | undefined;
}

export function removeRoom(roomId: string): void {
  db.prepare('DELETE FROM rooms WHERE room_id = ?').run(roomId);
}
