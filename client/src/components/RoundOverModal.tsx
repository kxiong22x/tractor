import type { Player } from '../types';
import { RANK_DISPLAY } from '../utils/cards';
import ModalShell from './ModalShell';

interface RoundResult {
  attackingPoints: number;
  defendingPoints: number;
  rankChanges: Record<string, { oldRank: number; newRank: number }>;
  nextKingId: string;
  winningTeam: 'attacking' | 'defending';
  kittyBonus: number;
  gameOver: boolean;
}

interface RoundOverModalProps {
  roundResult: RoundResult;
  players: Player[];
  onNextRound: () => void;
}

export default function RoundOverModal({ roundResult, players, onNextRound }: RoundOverModalProps) {
  return (
    <ModalShell>
        <h2 className="modal-heading">
          {roundResult.gameOver ? 'Game Over!' : 'Round Over'}
        </h2>
        <div
          className="round-result__winner"
          style={{ color: roundResult.winningTeam === 'attacking' ? '#e74c3c' : '#2980b9' }}
        >
          {roundResult.winningTeam === 'attacking' ? 'Attacking' : 'Defending'} team wins!
        </div>
        <div className="round-result__score">
          Attacking: {roundResult.attackingPoints} pts | Defending: {roundResult.defendingPoints} pts
        </div>
        {roundResult.kittyBonus > 0 && (
          <div className="round-result__kitty-bonus">
            (includes {roundResult.kittyBonus} kitty bonus pts)
          </div>
        )}
        <div className="round-result__rank-changes">
          {players.map(p => {
            const rc = roundResult.rankChanges[p.playerId];
            if (!rc) return null;
            const changed = rc.oldRank !== rc.newRank;
            return (
              <div key={p.playerId} className="round-result__rank-item">
                <strong>{p.displayName}</strong>: {RANK_DISPLAY[rc.oldRank] ?? String(rc.oldRank)}
                {changed && <span className="round-result__rank-up"> &rarr; {RANK_DISPLAY[rc.newRank] ?? String(rc.newRank)}</span>}
              </div>
            );
          })}
        </div>
        {roundResult.gameOver ? (
          <a href="/" className="btn--action-link">
            Return to Home
          </a>
        ) : (
          <button onClick={onNextRound} className="btn--success btn--large" style={{ border: 'none' }}>
            Next Round
          </button>
        )}
    </ModalShell>
  );
}
