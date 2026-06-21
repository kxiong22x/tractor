export default function TrickCompleteOverlay({ winnerName }: { winnerName: string }) {
  return (
    <div className="overlay-toast overlay-toast--trick">
      {winnerName} wins the trick!
    </div>
  );
}
