import ModalShell from './ModalShell';

interface Props {
  playerName: string;
}

export default function PlayerDisconnectedModal({ playerName }: Props) {
  return (
    <ModalShell>
      <h2 style={{ margin: '0 0 1rem', fontSize: '1.5rem' }}>{playerName} disconnected</h2>
      <p style={{ margin: '0 0 0.5rem' }}>Waiting for them to reconnect...</p>
      <p style={{ margin: 0, fontSize: '0.875rem', color: '#666' }}>
        They can rejoin by going to this room's URL and entering their name.
      </p>
    </ModalShell>
  );
}
