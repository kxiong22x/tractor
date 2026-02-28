import { Router, Request, Response } from 'express';
import { createRoom, getRoom } from './room.queries';
import { getPlayersInRoom } from './player.queries';

const router = Router();

router.post('/rooms', (_req: Request, res: Response) => {
  const room = createRoom();
  res.status(201).json({ roomId: room.room_id, url: room.url });
});

router.get('/rooms/:roomId', (req: Request, res: Response) => {
  const roomId = req.params.roomId as string;
  const room = getRoom(roomId);
  if (!room) {
    res.status(404).json({ error: 'Room not found' });
    return;
  }
  const players = getPlayersInRoom(room.room_id);
  res.json({ room, players });
});

router.get('/ping', (req: Request, res: Response) => {
  res.status(200).json({ message: 'ok' });
});

export default router;
