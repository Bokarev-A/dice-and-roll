import { useNavigate } from 'react-router-dom';
import styles from './BackButton.module.css';

interface BackButtonProps {
  to?: string;
}

export function BackButton({ to }: BackButtonProps) {
  const navigate = useNavigate();
  return (
    <button className={styles.back} onClick={() => to ? navigate(to) : navigate(-1)}>
      ← Назад
    </button>
  );
}
