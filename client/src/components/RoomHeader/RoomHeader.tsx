import PrimaryButton from '../PrimaryButton/PrimaryButton';
import styles from './RoomHeader.module.css';

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
    <div className={styles.header}>
      <h2 className={styles.heading}>Room: {roomId}</h2>
      <PrimaryButton onClick={handleCopy} size="small">Copy Link</PrimaryButton>
    </div>
  );
}
