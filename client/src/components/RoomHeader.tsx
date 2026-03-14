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
    <div className="room-header">
      <h2 style={{ margin: 0 }}>Room: {roomId}</h2>
      <PrimaryButton onClick={handleCopy} size="small">Copy Link</PrimaryButton>
    </div>
  );
}
