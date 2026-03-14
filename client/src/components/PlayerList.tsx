import type { Player } from '../types';

interface PlayerListProps {
  players: Player[];
}

export default function PlayerList({ players }: PlayerListProps) {
  return (
    <div style={{ marginTop: '1.25rem' }}>
      <h3>Players</h3>
      <ul className="player-list">
        {players.map((p) => (
          <li key={p.playerId} className="player-list__item">
            {p.displayName}
          </li>
        ))}
      </ul>
    </div>
  );
}
