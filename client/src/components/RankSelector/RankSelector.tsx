import { STARTING_RANK_OPTIONS, RANK_DISPLAY } from '../../utils/cards';
import styles from './RankSelector.module.css';

interface RankSelectorProps {
  value: number;
  onChange: (rank: number) => void;
}

export default function RankSelector({ value, onChange }: RankSelectorProps) {
  return (
    <div className={styles.wrapper}>
      <label className={styles.label}>Your starting rank:</label>
      <select
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="form-select"
      >
        {STARTING_RANK_OPTIONS.map((r) => (
          <option key={r} value={r}>{RANK_DISPLAY[r]}</option>
        ))}
      </select>
    </div>
  );
}
