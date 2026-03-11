interface ModalShellProps {
  children: React.ReactNode;
}

export default function ModalShell({ children }: ModalShellProps) {
  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 50,
      }}
    >
      <div
        style={{
          backgroundColor: '#fff',
          borderRadius: '1rem',
          padding: '2rem 2.5rem',
          minWidth: '22.5rem',
          textAlign: 'center',
          color: '#333',
        }}
      >
        {children}
      </div>
    </div>
  );
}
