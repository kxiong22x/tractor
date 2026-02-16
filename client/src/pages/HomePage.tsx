import { useNavigate } from 'react-router-dom';

export default function HomePage() {
  const navigate = useNavigate();

  const handleCreateRoom = async () => {
    const res = await fetch('http://localhost:3001/api/rooms', {
      method: 'POST',
    });
    const data = await res.json();
    navigate(`/room/${data.roomId}`);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', textAlign: 'center' }}>
      <h1>Tractor / Finding Friends</h1>
      <img src="/cards.png" alt="Cards" style={{ maxWidth: '300px', width: '100%', margin: '20px 0' }} />
      <p>Create a room and invite your friends to play!</p>
      <button
        onClick={handleCreateRoom}
        style={{
          padding: '12px 32px',
          fontSize: '18px',
          cursor: 'pointer',
          borderRadius: '8px',
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
