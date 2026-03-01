interface Props {
  playerName: string;
}

export default function PlayerDisconnectedModal({ playerName }: Props) {
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
        <h2 style={{ margin: '0 0 1rem', fontSize: '1.5rem' }}>{playerName} disconnected</h2>
        <p style={{ margin: '0 0 0.5rem' }}>Waiting for them to reconnect...</p>
        <p style={{ margin: 0, fontSize: '0.875rem', color: '#666' }}>
          They can rejoin by going to this room's URL and entering their name.
        </p>
      </div>
    </div>
  );
}
