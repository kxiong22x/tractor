export default function TrickCompleteOverlay({ winnerName }: { winnerName: string }) {
  return (
    <div
      style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        color: 'white',
        padding: '1.25rem 2.5rem',
        borderRadius: '0.75rem',
        fontSize: '1.25rem',
        fontWeight: 'bold',
        zIndex: 30,
        textAlign: 'center',
      }}
    >
      {winnerName} wins the trick!
    </div>
  );
}
