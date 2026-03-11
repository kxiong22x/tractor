import { PRIMARY_BUTTON_SIZE_STYLES } from '../utils/primaryButton';

interface PrimaryButtonProps {
  onClick: () => void;
  children: React.ReactNode;
  size?: 'large' | 'small';
}

export default function PrimaryButton({ onClick, children, size = 'large' }: PrimaryButtonProps) {
  return (
    <button
      onClick={onClick}
      style={{
        cursor: 'pointer',
        border: 'none',
        backgroundColor: '#f7892e',
        color: 'white',
        ...PRIMARY_BUTTON_SIZE_STYLES[size],
      }}
    >
      {children}
    </button>
  );
}
