interface RoomHeaderProps {
  roomId: string;
}

export default function RoomHeader({ roomId }: RoomHeaderProps) {
  const shareUrl = `${window.location.origin}/room/${roomId}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(shareUrl);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '16px 0', gap: '12px' }}>
      <h2>Room: {roomId}</h2>
      <button
        onClick={handleCopy}
        style={{
          padding: '6px 16px',
          cursor: 'pointer',
          borderRadius: '6px',
          border: '1px solid black',
          backgroundColor: 'white',
          color: 'black',
        }}
      >
        Copy Link
      </button>
    </div>
  );
}
