import { useState } from 'react';

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
    <form onSubmit={handleSubmit} style={{ textAlign: 'center', marginTop: '2.5rem' }}>
      <h2>Enter your display name</h2>
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Your name"
        maxLength={20}
        className="form-input"
      />
      <button type="submit" style={{ border: 'none', padding: '0.5rem 1.5rem', borderRadius: '0.375rem' }}>
        Join
      </button>
    </form>
  );
}
