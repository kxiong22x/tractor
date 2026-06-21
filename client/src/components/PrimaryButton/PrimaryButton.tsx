interface PrimaryButtonProps {
  onClick?: () => void;
  children: React.ReactNode;
  size?: 'large' | 'small';
  type?: 'button' | 'submit';
}

export default function PrimaryButton({ onClick, children, size = 'large', type = 'button' }: PrimaryButtonProps) {
  return (
    <button type={type} onClick={onClick} className={`btn--${size}`}>
      {children}
    </button>
  );
}
