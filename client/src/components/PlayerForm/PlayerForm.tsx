import { useState } from 'react';
import styles from './PlayerForm.module.css';
import PrimaryButton from '../PrimaryButton/PrimaryButton';

interface PlayerFormProps {
  onJoin: (displayName: string) => void;
}

export default function PlayerForm({ onJoin }: PlayerFormProps) {
  const [name, setName] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (trimmed) {
      onJoin(trimmed);
    }
  };

  return (
    <form onSubmit={handleSubmit} className={styles.form}>
      <h2>Enter your display name</h2>
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Your name"
        maxLength={20}
        className="form-input"
      />
      <PrimaryButton type="submit" size="small">Join</PrimaryButton>
    </form>
  );
}
