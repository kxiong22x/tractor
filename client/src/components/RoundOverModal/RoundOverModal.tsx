import type { Player } from '../../types';
import { RANK_DISPLAY } from '../../utils/cards';
import ModalShell from '../ModalShell/ModalShell';
import modalStyles from '../ModalShell/ModalShell.module.css';
import styles from './RoundOverModal.module.css';

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
      <h2 className={modalStyles.heading}>
        {roundResult.gameOver ? 'Game Over!' : 'Round Over'}
      </h2>
      <div
        className={styles.winner}
        style={{ color: roundResult.winningTeam === 'attacking' ? '#e74c3c' : '#2980b9' }}
      >
        {roundResult.winningTeam === 'attacking' ? 'Attacking' : 'Defending'} team wins!
      </div>
      <div className={styles.score}>
        Attacking: {roundResult.attackingPoints} pts | Defending: {roundResult.defendingPoints} pts
      </div>
      {roundResult.kittyBonus > 0 && (
        <div className={styles.kittyBonus}>
          (includes {roundResult.kittyBonus} kitty bonus pts)
        </div>
      )}
      <div className={styles.rankChanges}>
        {players.map(p => {
          const rc = roundResult.rankChanges[p.playerId];
          if (!rc) return null;
          const changed = rc.oldRank !== rc.newRank;
          return (
            <div key={p.playerId} className={styles.rankItem}>
              <strong>{p.displayName}</strong>: {RANK_DISPLAY[rc.oldRank] ?? String(rc.oldRank)}
              {changed && <span className={styles.rankUp}> &rarr; {RANK_DISPLAY[rc.newRank] ?? String(rc.newRank)}</span>}
            </div>
          );
        })}
      </div>
      {roundResult.gameOver ? (
        <a href="/" className="btn--action-link">
          Return to Home
        </a>
      ) : (
        <button onClick={onNextRound} className={`btn--success btn--large ${styles.nextRoundBtn}`}>
          Next Round
        </button>
      )}
    </ModalShell>
  );
}
