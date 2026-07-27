import { useReducer, useState } from 'react';
import { EVENTS } from '../../../../shared/events';
import { useParams, useNavigate } from 'react-router-dom';
import { useSocket } from '../../hooks/useSocket';
import { roomReducer, initialRoomState } from './roomState';
import PlayerForm from '../../components/PlayerForm/PlayerForm';
import PlayerList from '../../components/PlayerList/PlayerList';
import RoomHeader from '../../components/RoomHeader/RoomHeader';
import CenteredPage from '../../components/CenteredPage/CenteredPage';
import PrimaryButton from '../../components/PrimaryButton/PrimaryButton';
import RankSelector from '../../components/RankSelector/RankSelector';
import styles from './RoomPage.module.css';
import { useRoomData } from '../../hooks/useRoomData';
import { useRoomSocket } from '../../hooks/useRoomSocket';

// ── Component ─────────────────────────────────────────────────────────

export default function RoomPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const socket = useSocket();

  const [state, dispatch] = useReducer(roomReducer, initialRoomState);
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
        <PrimaryButton onClick={() => navigate('/')} size="small">Back to Home</PrimaryButton>
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
      <p>Share the room link with other players so they can join! You need 4 players to start.</p>
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
