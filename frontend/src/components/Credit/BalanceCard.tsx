import { formatCredits } from '../../utils/format';
import styles from './BalanceCard.module.css';

interface BalanceCardProps {
  total: number;
  onClick?: () => void;
}

export function BalanceCard({ total, onClick }: BalanceCardProps) {
  return (
    <div className={`card card-glow ${styles.balance}`} onClick={onClick}>
      <div className={styles.label}>Баланс кредитов</div>
      <div className={styles.value}>{total}</div>
      <div className={styles.sub}>{formatCredits(total)} доступно</div>
      <div className={styles.glow} />
    </div>
  );
}