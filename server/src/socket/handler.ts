import { Server, Socket } from 'socket.io';
import { registerRoomHandlers } from './handlers/room';
import { registerGameHandlers } from './handlers/game';
import { registerTrumpHandlers } from './handlers/trump';
import { registerTrickHandlers } from './handlers/trick';

export function registerSocketHandlers(io: Server) {
  io.on('connection', (socket: Socket) => {
    console.log(`Socket connected: ${socket.id}`);

    registerRoomHandlers(io, socket);
    registerGameHandlers(io, socket);
    registerTrumpHandlers(io, socket);
    registerTrickHandlers(io, socket);
  });
}
