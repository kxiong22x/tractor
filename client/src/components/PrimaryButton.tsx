interface PrimaryButtonProps {
  onClick: () => void;
  children: React.ReactNode;
  size?: 'large' | 'small';
}

export default function PrimaryButton({ onClick, children, size = 'large' }: PrimaryButtonProps) {
  return (
    <button onClick={onClick} className={`btn--${size}`}>
      {children}
    </button>
  );
}
