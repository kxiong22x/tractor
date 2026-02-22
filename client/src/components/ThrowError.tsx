export default function ThrowError({ message }: { message: string }) {
  return (
    <div
      style={{
        position: 'absolute',
        top: '45%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        backgroundColor: 'rgba(200, 50, 50, 0.85)',
        color: 'white',
        padding: '0.875rem 1.75rem',
        borderRadius: '0.625rem',
        fontSize: '1rem',
        fontWeight: 'bold',
        zIndex: 35,
        textAlign: 'center',
      }}
    >
      {message}
    </div>
  );
}
