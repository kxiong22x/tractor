import type { Player } from '../types';

interface PlayerListProps {
  players: Player[];
}

export default function PlayerList({ players }: PlayerListProps) {
  return (
    <div style={{ marginTop: '20px' }}>
      <h3>Players</h3>
      <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'center' }}>
        {players.map((p) => (
          <li
            key={p.player_id}
            style={{
              padding: '8px 16px',
              backgroundColor: 'white',
              color: 'black',
              border: '1px solid black',
              borderRadius: '6px',
              fontSize: '16px',
            }}
          >
            {p.display_name}
          </li>
        ))}
      </ul>
    </div>
  );
}
