import { useReducer, useState } from 'react';
import { EVENTS } from '../../../../shared/events';
import { useParams, useNavigate } from 'react-router-dom';
import { useSocket } from '../../hooks/useSocket';
import { type Player } from '../../types';
import PlayerForm from '../../components/PlayerForm/PlayerForm';
import PlayerList from '../../components/PlayerList/PlayerList';
import RoomHeader from '../../components/RoomHeader/RoomHeader';
import CenteredPage from '../../components/CenteredPage/CenteredPage';
import PrimaryButton from '../../components/PrimaryButton/PrimaryButton';
import RankSelector from '../../components/RankSelector/RankSelector';
import styles from './RoomPage.module.css';
import { useRoomData } from '../../hooks/useRoomData';
import { useRoomSocket } from '../../hooks/useRoomSocket';

// ── State & Action types ──────────────────────────────────────────────

interface RoomState {
  joined: boolean;
  players: Player[];
  error: string | null;
}

export type RoomAction =
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
  const [startingRank, setStartingRank] = useState(2);

  useRoomData(roomId, dispatch);
  useRoomSocket({ socket, roomId, dispatch, navigate });

  const handleJoin = (displayName: string) => {
    socket.emit(EVENTS.JOIN_ROOM, { roomId, displayName, startingRank: 2 });
    dispatch({ type: 'JOINED' });
  };

  const handleRankChange = (rank: number) => {
    setStartingRank(rank);
    socket.emit(EVENTS.SET_STARTING_RANK, { roomId, rank });
  };

  const handleStartGame = () => {
    socket.emit(EVENTS.START_GAME, { roomId });
  };

  if (error) {
    return (
      <CenteredPage>
        <h2>{error}</h2>
        <button onClick={() => navigate('/')} className={styles.errorBtn}>
          Back to Home
        </button>
      </CenteredPage>
    );
  }

  if (!joined) {
    return (
      <CenteredPage maxWidth="31.25rem">
        <h2>Room: {roomId}</h2>
        <PlayerForm onJoin={handleJoin} />
      </CenteredPage>
    );
  }

  return (
    <CenteredPage maxWidth="31.25rem">
      <RoomHeader roomId={roomId!} />
      <p>You need 4 players to start.</p>
      <PlayerList players={players} />
      <RankSelector value={startingRank} onChange={handleRankChange} />
      {players.length >= 4 && (
        <div className={styles.startSection}>
          <PrimaryButton onClick={handleStartGame}>Start Game</PrimaryButton>
        </div>
      )}
    </CenteredPage>
  );
}
