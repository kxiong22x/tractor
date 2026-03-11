interface CenteredPageProps {
  children: React.ReactNode;
  maxWidth?: string;
}

export default function CenteredPage({ children, maxWidth }: CenteredPageProps) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        textAlign: 'center',
        ...(maxWidth ? { maxWidth, margin: '0 auto' } : {}),
      }}
    >
      {children}
    </div>
  );
}
