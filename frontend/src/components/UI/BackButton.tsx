import { useNavigate } from 'react-router-dom';
import styles from './BackButton.module.css';

interface BackButtonProps {
  to?: string;
  replace?: boolean;
}

export function BackButton({ to, replace }: BackButtonProps) {
  const navigate = useNavigate();
  return (
    <button className={styles.back} onClick={() => to ? navigate(to, { replace }) : navigate(-1)}>
      ‹ Назад
    </button>
  );
}
