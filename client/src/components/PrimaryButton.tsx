import type { CSSProperties } from 'react';

const sizeStyles: Record<'large' | 'small', CSSProperties> = {
  large: { padding: '0.75rem 2rem', fontSize: '1.125rem', borderRadius: '0.5rem' },
  small: { padding: '0.375rem 1rem', borderRadius: '0.375rem' },
};

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
        ...sizeStyles[size],
      }}
    >
      {children}
    </button>
  );
}
