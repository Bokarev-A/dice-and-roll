import type { Product } from '../../types/index';
import { formatPrice, pluralGames } from '../../utils/format';
import styles from './ProductCard.module.css';

interface ProductCardProps {
  product: Product;
  onBuy: (product: Product) => void;
  basePrice?: number;
}

export function ProductCard({ product, onBuy, basePrice = 700 }: ProductCardProps) {
  const perGame = product.price / product.credits;
  const discount = product.credits > 1
    ? Math.round((1 - perGame / basePrice) * 100)
    : 0;

  const pluralLabel = product.credits === 1
    ? (product.category === 'gm_room' ? 'аренда' : 'игра')
    : pluralGames(product.credits);

  return (
    <div className={`card ${styles.product}`}>
      <div className={styles.header}>
        <h3 className={styles.name}>{product.name}</h3>
        {discount > 0 && (
          <span className={styles.discount}>-{discount}%</span>
        )}
      </div>

      <div className={styles.details}>
        <div className={styles.credits}>
          <span className={styles.creditsValue}>{product.credits}</span>
          <span className={styles.creditsLabel}>{pluralLabel}</span>
        </div>

        {product.duration_months && (
          <div className={styles.duration}>
            ⏱ {product.duration_months} мес.
          </div>
        )}
      </div>

      <div className={styles.priceRow}>
        <div className={styles.price}>{formatPrice(product.price)}</div>
        <div className={styles.perGame}>
          {formatPrice(Math.round(perGame))} / {product.category === 'gm_room' ? 'игра' : 'игра'}
        </div>
      </div>

      <button
        className="btn btn-primary btn-block"
        onClick={() => onBuy(product)}
      >
        Купить
      </button>
    </div>
  );
}