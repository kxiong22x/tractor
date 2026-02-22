import { useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../config';

export default function HomePage() {
  const navigate = useNavigate();

  const handleCreateRoom = async () => {
    const res = await fetch(`${API_BASE_URL}/api/rooms`, {
      method: 'POST',
    });
    const data = await res.json();
    navigate(`/room/${data.roomId}`);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', textAlign: 'center' }}>
      <h1>Tractor</h1>
      <img src={`${import.meta.env.BASE_URL}cards.png`} alt="Cards" style={{ maxWidth: '18.75rem', width: '100%', margin: '1.25rem 0' }} />
      <p>Create a room and invite your friends to play! Currently only 4 player games are supported. </p>
      <button
        onClick={handleCreateRoom}
        style={{
          padding: '0.75rem 2rem',
          fontSize: '1.125rem',
          cursor: 'pointer',
          borderRadius: '0.5rem',
          border: 'none',
          backgroundColor: '#f7892e',
          color: 'white',
        }}
      >
        Create Room
      </button>
    </div>
  );
}
