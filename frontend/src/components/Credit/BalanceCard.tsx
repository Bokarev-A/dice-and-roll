import { formatCredits } from '../../utils/format';
import styles from './BalanceCard.module.css';

interface BalanceCardProps {
  totalCredits: number;
  totalRentals?: number;
  showRentals?: boolean;
  onClick?: () => void;
}

export function BalanceCard({ totalCredits, totalRentals = 0, showRentals = false, onClick }: BalanceCardProps) {
  return (
    <div className={`card card-glow ${styles.balance}`} onClick={onClick}>
      <div className={styles.row}>
        <div className={styles.block}>
          <div className={styles.label}>Кредиты</div>
          <div className={styles.value}>{totalCredits}</div>
          <div className={styles.sub}>{formatCredits(totalCredits)} доступно</div>
        </div>
        {showRentals && (
          <div className={styles.block}>
            <div className={styles.labelRental}>Аренды</div>
            <div className={styles.valueRental}>{totalRentals}</div>
            <div className={styles.sub}>{totalRentals} доступно</div>
          </div>
        )}
      </div>
      <div className={styles.glow} />
    </div>
  );
}
