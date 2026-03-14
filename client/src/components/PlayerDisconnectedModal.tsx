import ModalShell from './ModalShell';

interface Props {
  playerName: string;
}

export default function PlayerDisconnectedModal({ playerName }: Props) {
  return (
    <ModalShell>
      <h2 className="modal-heading">{playerName} disconnected</h2>
      <p style={{ margin: '0 0 0.5rem' }}>Waiting for them to reconnect...</p>
      <p className="modal-subtext">
        They can rejoin by going to this room's URL and entering their name.
      </p>
    </ModalShell>
  );
}
