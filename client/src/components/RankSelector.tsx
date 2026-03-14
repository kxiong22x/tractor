import { STARTING_RANK_OPTIONS, RANK_DISPLAY } from '../utils/cards';

interface RankSelectorProps {
  value: number;
  onChange: (rank: number) => void;
}

export default function RankSelector({ value, onChange }: RankSelectorProps) {
  return (
    <div style={{ marginTop: '1rem' }}>
      <label style={{ marginRight: '0.5rem' }}>Your starting rank:</label>
      <select
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{
          padding: '0.4rem 0.75rem',
          fontSize: '1rem',
          borderRadius: '0.375rem',
          border: '0.0625rem solid black',
          backgroundColor: 'white',
          color: 'black',
        }}
      >
        {STARTING_RANK_OPTIONS.map((r) => (
          <option key={r} value={r}>{RANK_DISPLAY[r]}</option>
        ))}
      </select>
    </div>
  );
}
