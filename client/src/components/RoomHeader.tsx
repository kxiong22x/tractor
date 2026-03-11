import PrimaryButton from './PrimaryButton';

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
      <PrimaryButton onClick={handleCopy} size="small">Copy Link</PrimaryButton>
    </div>
  );
}
