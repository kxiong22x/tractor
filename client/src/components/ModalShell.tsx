interface ModalShellProps {
  children: React.ReactNode;
}

export default function ModalShell({ children }: ModalShellProps) {
  return (
    <div className="modal-overlay">
      <div className="modal-box">
        {children}
      </div>
    </div>
  );
}
