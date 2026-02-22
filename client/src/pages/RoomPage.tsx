import { useReducer, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSocket } from '../hooks/useSocket';
import type { Player } from '../types';
import PlayerForm from '../components/PlayerForm';
import PlayerList from '../components/PlayerList';
import RoomHeader from '../components/RoomHeader';
import { API_BASE_URL } from '../config';

// ── State & Action types ──────────────────────────────────────────────

interface RoomState {
  joined: boolean;
  players: Player[];
  error: string | null;
}

type RoomAction =
  | { type: 'PLAYERS_LOADED'; players: Player[] }
  | { type: 'LOAD_ERROR'; message: string }
  | { type: 'JOINED' }
  | { type: 'PLAYER_JOINED'; players: Player[] }
  | { type: 'PLAYER_LEFT'; players: Player[] }
  | { type: 'ROOM_ERROR'; message: string };

// ── Reducer ───────────────────────────────────────────────────────────

function roomReducer(state: RoomState, action: RoomAction): RoomState {
  switch (action.type) {
    case 'PLAYERS_LOADED':
      return { ...state, players: action.players };
    case 'LOAD_ERROR':
      return { ...state, error: action.message };
    case 'JOINED':
      return { ...state, joined: true, error: null };
    case 'PLAYER_JOINED':
      return { ...state, players: action.players };
    case 'PLAYER_LEFT':
      return { ...state, players: action.players };
    case 'ROOM_ERROR':
      return { ...state, error: action.message };
    default:
      return state;
  }
}

const initialState: RoomState = {
  joined: false,
  players: [],
  error: null,
};

// ── Component ─────────────────────────────────────────────────────────

export default function RoomPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const socket = useSocket();

  const [state, dispatch] = useReducer(roomReducer, initialState);
  const { joined, players, error } = state;

  useEffect(() => {
    // Fetch initial room data
    fetch(`${API_BASE_URL}/api/rooms/${roomId}`)
      .then((res) => {
        if (!res.ok) throw new Error('Room not found');
        return res.json();
      })
      .then((data) => dispatch({ type: 'PLAYERS_LOADED', players: data.players }))
      .catch(() => dispatch({ type: 'LOAD_ERROR', message: 'Room not found' }));
  }, [roomId]);

  useEffect(() => {
    const onPlayerJoined = (data: { player: Player; players: Player[] }) => {
      dispatch({ type: 'PLAYER_JOINED', players: data.players });
    };

    const onPlayerLeft = (data: { playerId: string; players: Player[] }) => {
      dispatch({ type: 'PLAYER_LEFT', players: data.players });
    };

    const onRoomError = (data: { message: string }) => {
      dispatch({ type: 'ROOM_ERROR', message: data.message });
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
    dispatch({ type: 'JOINED' });
  };

  const handleStartGame = () => {
    socket.emit('start-game', { roomId });
  };

  if (error) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', textAlign: 'center' }}>
        <h2>{error}</h2>
        <button onClick={() => navigate('/')} style={{ marginTop: '1rem', padding: '0.5rem 1.5rem', cursor: 'pointer' }}>
          Back to Home
        </button>
      </div>
    );
  }

  if (!joined) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', textAlign: 'center', maxWidth: '31.25rem', margin: '0 auto' }}>
        <h2>Room: {roomId}</h2>
        <PlayerForm onJoin={handleJoin} />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', textAlign: 'center', maxWidth: '31.25rem', margin: '0 auto' }}>
      <RoomHeader roomId={roomId!} />
      <PlayerList players={players} />
      {players.length >= 4 && (
        <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
          <button
            onClick={handleStartGame}
            style={{
              padding: '0.75rem 2rem',
              fontSize: '1.125rem',
              cursor: 'pointer',
              borderRadius: '0.5rem',
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
