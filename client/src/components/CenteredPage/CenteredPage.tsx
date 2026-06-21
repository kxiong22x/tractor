import styles from './CenteredPage.module.css';

interface CenteredPageProps {
  children: React.ReactNode;
  maxWidth?: string;
}

export default function CenteredPage({ children, maxWidth }: CenteredPageProps) {
  return (
    <div
      className={styles.centeredPage}
      style={maxWidth ? { maxWidth, margin: '0 auto' } : undefined}
    >
      {children}
    </div>
  );
}
