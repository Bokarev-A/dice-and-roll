import { formatCredits } from '../../utils/format';
import styles from './BalanceCard.module.css';

interface BalanceCardProps {
  totalCredits: number;
  totalRentals?: number;
  totalGmRewards?: number;
  showRentals?: boolean;
  showGmRewards?: boolean;
  onClick?: () => void;
}

export function BalanceCard({
  totalCredits,
  totalRentals = 0,
  totalGmRewards = 0,
  showRentals = false,
  showGmRewards = false,
  onClick,
}: BalanceCardProps) {
  const isDebt = totalCredits < 0;

  return (
    <div className={`card card-glow ${styles.balance}`} onClick={onClick}>
      <div className={styles.row}>
        <div className={styles.block}>
          <div className={styles.label}>Кредиты</div>
          <div className={isDebt ? styles.valueDebt : styles.value}>{totalCredits}</div>
          <div className={isDebt ? styles.subDebt : styles.sub}>
            {isDebt ? '⚠ Есть долг — купите кредиты' : `${formatCredits(totalCredits)} доступно`}
          </div>
        </div>
        {showRentals && (
          <div className={styles.block}>
            <div className={styles.labelRental}>Аренды</div>
            <div className={styles.valueRental}>{totalRentals}</div>
            <div className={styles.sub}>{totalRentals} доступно</div>
          </div>
        )}
        {showGmRewards && (
          <div className={styles.block}>
            <div className={styles.labelGm}>Мастерские</div>
            <div className={styles.valueGm}>{totalGmRewards}</div>
            <div className={styles.sub}>{totalGmRewards} доступно</div>
          </div>
        )}
      </div>
      <div className={styles.glow} />
    </div>
  );
}
