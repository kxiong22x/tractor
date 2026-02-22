interface RoomHeaderProps {
  roomId: string;
}

export default function RoomHeader({ roomId }: RoomHeaderProps) {
  const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');
  const shareUrl = `${window.location.origin}${basePath}/room/${roomId}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(shareUrl);
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem 0', gap: '0.75rem' }}>
      <h2 style={{ margin: 0 }}>Room: {roomId}</h2>
      <button
        onClick={handleCopy}
        style={{
          padding: '0.375rem 1rem',
          cursor: 'pointer',
          borderRadius: '0.375rem',
          border: 'none',
          backgroundColor: '#f7892e',
          color: 'white',
        }}
      >
        Copy Link
      </button>
    </div>
  );
}
