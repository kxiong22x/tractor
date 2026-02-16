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
    <form onSubmit={handleSubmit} style={{ textAlign: 'center', marginTop: '40px' }}>
      <h2>Enter your display name</h2>
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Your name"
        maxLength={20}
        style={{
          padding: '8px 16px',
          fontSize: '16px',
          borderRadius: '6px',
          border: '1px solid black',
          backgroundColor: 'white',
          color: 'black',
          marginRight: '8px',
        }}
      />
      <button
        type="submit"
        style={{
          padding: '8px 24px',
          fontSize: '16px',
          cursor: 'pointer',
          borderRadius: '6px',
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
