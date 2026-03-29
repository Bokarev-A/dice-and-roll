import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { productsApi } from '../../api/products';
import { ordersApi } from '../../api/orders';
import type { Product } from '../../types/index';
import { ProductCard } from '../../components/Order/ProductCard';
import { Loader } from '../../components/UI/Loader';
import { useUIStore } from '../../store/useUIStore';
import styles from './ShopPage.module.css';

export function ShopPage() {
  const navigate = useNavigate();
  const showToast = useUIStore((s) => s.showToast);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState(false);

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

  return (
    <div className={`animate-fade-in ${styles.page}`}>
      <h1>Магазин</h1>
      <p className={styles.subtitle}>Выберите абонемент для игр</p>

      <div className={styles.list}>
        {products.map((p) => (
          <ProductCard key={p.id} product={p} onBuy={handleBuy} />
        ))}
      </div>
    </div>
  );
}