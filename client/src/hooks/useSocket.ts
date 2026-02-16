import { useEffect } from 'react';
import socket from '../socket';

export function useSocket() {
  useEffect(() => {
    if (!socket.connected) {
      socket.connect();
    }
  }, []);

  return socket;
}
