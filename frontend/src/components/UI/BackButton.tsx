import { useNavigate } from 'react-router-dom';
import styles from './BackButton.module.css';

interface BackButtonProps {
  to: string;
}

export function BackButton({ to }: BackButtonProps) {
  const navigate = useNavigate();
  return (
    <button className={styles.back} onClick={() => navigate(to)}>
      ← Назад
    </button>
  );
}
