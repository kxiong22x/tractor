import type { Player } from '../types';
import { RANK_DISPLAY } from '../utils/cards';

interface RoundResult {
  attackingPoints: number;
  defendingPoints: number;
  rankChanges: Record<string, { oldRank: number; newRank: number }>;
  nextKingId: string;
  winningTeam: 'attacking' | 'defending';
  kittyBonus: number;
}

interface RoundOverModalProps {
  roundResult: RoundResult;
  players: Player[];
  onNextRound: () => void;
}

export default function RoundOverModal({ roundResult, players, onNextRound }: RoundOverModalProps) {
  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 50,
      }}
    >
      <div
        style={{
          backgroundColor: '#fff',
          borderRadius: '1rem',
          padding: '2rem 2.5rem',
          minWidth: '22.5rem',
          textAlign: 'center',
          color: '#333',
        }}
      >
        <h2 style={{ margin: '0 0 1rem', fontSize: '1.5rem' }}>
          Round Over
        </h2>
        <div style={{ fontSize: '1.125rem', fontWeight: 'bold', marginBottom: '0.75rem', color: roundResult.winningTeam === 'attacking' ? '#e74c3c' : '#2980b9' }}>
          {roundResult.winningTeam === 'attacking' ? 'Attacking' : 'Defending'} team wins!
        </div>
        <div style={{ fontSize: '0.875rem', marginBottom: '0.5rem' }}>
          Attacking: {roundResult.attackingPoints} pts | Defending: {roundResult.defendingPoints} pts
        </div>
        {roundResult.kittyBonus > 0 && (
          <div style={{ fontSize: '0.8125rem', marginBottom: '0.75rem', opacity: 0.7 }}>
            (includes {roundResult.kittyBonus} kitty bonus pts)
          </div>
        )}
        <div style={{ marginBottom: '1.25rem' }}>
          {players.map(p => {
            const rc = roundResult.rankChanges[p.player_id];
            if (!rc) return null;
            const changed = rc.oldRank !== rc.newRank;
            return (
              <div key={p.player_id} style={{ fontSize: '0.875rem', marginBottom: '0.25rem' }}>
                <strong>{p.display_name}</strong>: {RANK_DISPLAY[rc.oldRank] ?? String(rc.oldRank)}
                {changed && <span style={{ color: '#27ae60' }}> &rarr; {RANK_DISPLAY[rc.newRank] ?? String(rc.newRank)}</span>}
              </div>
            );
          })}
        </div>
        <button
          onClick={onNextRound}
          style={{
            padding: '0.75rem 2rem',
            fontSize: '1rem',
            fontWeight: 'bold',
            backgroundColor: '#4CAF50',
            color: 'white',
            border: 'none',
            borderRadius: '0.5rem',
            cursor: 'pointer',
          }}
        >
          Next Round
        </button>
      </div>
    </div>
  );
}
