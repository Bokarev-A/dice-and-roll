import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { productsApi } from '../../api/products';
import { ordersApi } from '../../api/orders';
import type { Product } from '../../types/index';
import { ProductCard } from '../../components/Order/ProductCard';
import { Loader } from '../../components/UI/Loader';
import { useUIStore } from '../../store/useUIStore';
import { useAuthStore } from '../../store/useAuthStore';
import styles from './ShopPage.module.css';

type Tab = 'player' | 'gm_room';

export function ShopPage() {
  const navigate = useNavigate();
  const showToast = useUIStore((s) => s.showToast);
  const user = useAuthStore((s) => s.user);
  const isGmOrAdmin = user?.role === 'private_gm' || user?.role === 'admin';
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState(false);
  const [tab, setTab] = useState<Tab>('player');

  useEffect(() => {
    async function load() {
      try {
        const data = await productsApi.list();
        setProducts(data);
      } catch {
        // silent
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  async function handleBuy(product: Product) {
    if (buying) return;
    setBuying(true);
    try {
      const order = await ordersApi.create(product.id);
      showToast('Заказ создан!', 'success');
      navigate(`/shop/pay/${order.id}`);
    } catch (err: any) {
      const msg = err.response?.data?.detail || 'Ошибка создания заказа';
      showToast(msg, 'error');
    } finally {
      setBuying(false);
    }
  }

  if (loading) return <Loader />;

  const filtered = products.filter((p) => p.category === tab);
  const basePrice = tab === 'player' ? 700 : 2500;

  return (
    <div className={`animate-fade-in ${styles.page}`}>
      <h1>Магазин</h1>

      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${tab === 'player' ? styles.tabActive : ''}`}
          onClick={() => setTab('player')}
        >
          🎮 Для игроков
        </button>
        {isGmOrAdmin && (
          <button
            className={`${styles.tab} ${tab === 'gm_room' ? styles.tabActive : ''}`}
            onClick={() => setTab('gm_room')}
          >
            🎲 Для мастеров
          </button>
        )}
      </div>

      <p className={styles.subtitle}>
        {tab === 'player'
          ? 'Абонементы на игры'
          : 'Аренда комнат для проведения игр'}
      </p>

      <div className={styles.list}>
        {filtered.map((p) => (
          <ProductCard key={p.id} product={p} onBuy={handleBuy} basePrice={basePrice} />
        ))}
      </div>
    </div>
  );
}