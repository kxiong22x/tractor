import type { Player } from '../../types';
import styles from './PlayerList.module.css';

interface PlayerListProps {
  players: Player[];
}

export default function PlayerList({ players }: PlayerListProps) {
  return (
    <div className={styles.wrapper}>
      <h3>Players</h3>
      <ul className={styles.list}>
        {players.map((p) => (
          <li key={p.playerId} className={styles.item}>
            {p.displayName}
          </li>
        ))}
      </ul>
    </div>
  );
}
