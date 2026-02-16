import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSocket } from '../hooks/useSocket';
import type { Player } from '../types';
import PlayerForm from '../Player/PlayerForm';
import PlayerList from '../Player/PlayerList';
import RoomHeader from './RoomHeader';

export default function RoomPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const socket = useSocket();

  const [joined, setJoined] = useState(false);
  const [players, setPlayers] = useState<Player[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Fetch initial room data
    fetch(`http://localhost:3001/api/rooms/${roomId}`)
      .then((res) => {
        if (!res.ok) throw new Error('Room not found');
        return res.json();
      })
      .then((data) => setPlayers(data.players))
      .catch(() => setError('Room not found'));
  }, [roomId]);

  useEffect(() => {
    const onPlayerJoined = (data: { player: Player; players: Player[] }) => {
      setPlayers(data.players);
    };

    const onPlayerLeft = (data: { playerId: string; players: Player[] }) => {
      setPlayers(data.players);
    };

    const onRoomError = (data: { message: string }) => {
      setError(data.message);
    };

    const onGameStarted = (data: { gameId: string; players: Array<Player & { hand: string[] }>; trumpNumber: string; trumpSuit: string }) => {
      console.log('game-started received:', data);
      navigate(`/room/${roomId}/game`, {
        state: { gameId: data.gameId, players: data.players, trumpNumber: data.trumpNumber, trumpSuit: data.trumpSuit },
      });
    };

    socket.on('player-joined', onPlayerJoined);
    socket.on('player-left', onPlayerLeft);
    socket.on('room-error', onRoomError);
    socket.on('game-started', onGameStarted);

    return () => {
      socket.off('player-joined', onPlayerJoined);
      socket.off('player-left', onPlayerLeft);
      socket.off('room-error', onRoomError);
      socket.off('game-started', onGameStarted);
    };
  }, [socket]);

  const handleJoin = (displayName: string) => {
    socket.emit('join-room', { roomId, displayName });
    setJoined(true);
    setError(null);
  };

  const handleStartGame = () => {
    socket.emit('start-game', { roomId });
  };

  if (error) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', textAlign: 'center' }}>
        <h2>{error}</h2>
        <button onClick={() => navigate('/')} style={{ marginTop: '16px', padding: '8px 24px', cursor: 'pointer' }}>
          Back to Home
        </button>
      </div>
    );
  }

  if (!joined) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', textAlign: 'center', maxWidth: '500px', margin: '0 auto' }}>
        <h2>Room: {roomId}</h2>
        <PlayerForm onJoin={handleJoin} />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', textAlign: 'center', maxWidth: '500px', margin: '0 auto' }}>
      <RoomHeader roomId={roomId!} />
      <PlayerList players={players} />
      {players.length >= 4 && (
        <div style={{ textAlign: 'center', marginTop: '24px' }}>
          <button
            onClick={handleStartGame}
            style={{
              padding: '12px 32px',
              fontSize: '18px',
              cursor: 'pointer',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: '#f7892e',
              color: 'white',
            }}
          >
            Start Game
          </button>
        </div>
      )}
    </div>
  );
}
