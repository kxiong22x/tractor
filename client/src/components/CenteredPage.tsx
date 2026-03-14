interface CenteredPageProps {
  children: React.ReactNode;
  maxWidth?: string;
}

export default function CenteredPage({ children, maxWidth }: CenteredPageProps) {
  return (
    <div
      className="centered-page"
      style={maxWidth ? { maxWidth, margin: '0 auto' } : undefined}
    >
      {children}
    </div>
  );
}
