import { useUIStore } from '../../store/useUIStore';
import styles from './Toast.module.css';

export function Toast() {
  const toast = useUIStore((s) => s.toast);

  if (!toast) return null;

  const colorMap = {
    success: 'var(--neon-green)',
    error: 'var(--neon-orange)',
    info: 'var(--neon-blue)',
  };

  return (
    <div
      className={styles.toast}
      style={{ borderColor: colorMap[toast.type] }}
    >
      <span
        className={styles.icon}
        style={{ color: colorMap[toast.type] }}
      >
        {toast.type === 'success' ? '✓' : toast.type === 'error' ? '✕' : 'ℹ'}
      </span>
      <span className={styles.message}>{toast.message}</span>
    </div>
  );
}