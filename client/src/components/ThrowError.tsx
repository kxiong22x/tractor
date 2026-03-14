export default function ThrowError({ message }: { message: string }) {
  return (
    <div className="overlay-toast overlay-toast--error">
      {message}
    </div>
  );
}
