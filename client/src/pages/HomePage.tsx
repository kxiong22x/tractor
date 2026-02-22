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
      <p style={{ margin: '0.1rem 0 0.5rem', fontSize: '2.25rem' }}>拖拉机</p>
      <img src={`${import.meta.env.BASE_URL}cards.png`} alt="Cards" style={{ maxWidth: '18.75rem', width: '100%', margin: '1.25rem 0' }} />
      <p>
        <div>Tractor is a popular Chinese card game. This website is an online version of it!</div>
        <div>Create a room and invite your friends to play - currently only 4 player games are supported.</div>
      </p>
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
      <div style={{ marginTop: '2.5rem', display: 'flex', gap: '1.5rem', justifyContent: 'center', alignItems: 'center' }}>
        <a href="https://www.pagat.com/kt5/tractor.html" target="_blank" rel="noreferrer">
          Tractor Rules
        </a>
        <a href="https://github.com/kxiong22x/tractor" target="_blank" rel="noreferrer">
          GitHub Repo
        </a>
      </div>
    </div>
  );
}
