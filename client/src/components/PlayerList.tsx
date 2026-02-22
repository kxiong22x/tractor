import type { Player } from '../types';

interface PlayerListProps {
  players: Player[];
}

export default function PlayerList({ players }: PlayerListProps) {
  return (
    <div style={{ marginTop: '1.25rem' }}>
      <h3>Players</h3>
      <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexWrap: 'wrap', gap: '0.5rem', justifyContent: 'center' }}>
        {players.map((p) => (
          <li
            key={p.player_id}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: 'white',
              color: 'black',
              border: '0.0625rem solid black',
              borderRadius: '0.375rem',
              fontSize: '1rem',
            }}
          >
            {p.display_name}
          </li>
        ))}
      </ul>
    </div>
  );
}
