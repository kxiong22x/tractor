import styles from './ModalShell.module.css';

interface ModalShellProps {
  children: React.ReactNode;
}

export default function ModalShell({ children }: ModalShellProps) {
  return (
    <div className={styles.overlay}>
      <div className={styles.box}>
        {children}
      </div>
    </div>
  );
}
