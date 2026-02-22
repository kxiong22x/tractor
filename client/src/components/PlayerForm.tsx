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
        style={{
          padding: '0.5rem 1rem',
          fontSize: '1rem',
          borderRadius: '0.375rem',
          border: '0.0625rem solid black',
          backgroundColor: 'white',
          color: 'black',
          marginRight: '0.5rem',
        }}
      />
      <button
        type="submit"
        style={{
          padding: '0.5rem 1.5rem',
          fontSize: '1rem',
          cursor: 'pointer',
          borderRadius: '0.375rem',
          border: 'none',
          backgroundColor: '#f7892e',
          color: 'white',
        }}
      >
        Join
      </button>
    </form>
  );
}
