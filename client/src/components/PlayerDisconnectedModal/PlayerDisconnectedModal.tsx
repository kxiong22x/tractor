import ModalShell from '../ModalShell/ModalShell';
import modalStyles from '../ModalShell/ModalShell.module.css';
import styles from './PlayerDisconnectedModal.module.css';

interface Props {
  playerName: string;
}

export default function PlayerDisconnectedModal({ playerName }: Props) {
  return (
    <ModalShell>
      <h2 className={modalStyles.heading}>{playerName} disconnected</h2>
      <p className={styles.waitText}>Waiting for them to reconnect...</p>
      <p className={modalStyles.subtext}>
        They can rejoin by going to this room's URL and entering their name.
      </p>
    </ModalShell>
  );
}
