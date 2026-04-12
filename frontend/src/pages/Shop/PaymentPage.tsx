import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ordersApi } from '../../api/orders';
import type { Order, QRPaymentInfo } from '../../types/index';
import { Loader } from '../../components/UI/Loader';
import { OrderBadge } from '../../components/UI/Badge';
import { BackButton } from '../../components/UI/BackButton';
import { formatPrice } from '../../utils/format';
import { useUIStore } from '../../store/useUIStore';
import styles from './PaymentPage.module.css';

export function PaymentPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const showToast = useUIStore((s) => s.showToast);
  const [order, setOrder] = useState<Order | null>(null);
  const [qr, setQR] = useState<QRPaymentInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const activeOrder = await ordersApi.myActive();
        setOrder(activeOrder);

        if (activeOrder.status === 'pending') {
          const qrData = await ordersApi.getQR();
          setQR(qrData);
        }
      } catch {
        navigate('/shop');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [orderId, navigate]);

  async function handleMarkPaid() {
    if (!order) return;
    setActionLoading(true);
    try {
      const updated = await ordersApi.markPaid(order.id);
      setOrder(updated);
      showToast('Отмечено как оплачено!', 'success');
    } catch (err: any) {
      showToast(err.response?.data?.detail || 'Ошибка', 'error');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleCancel() {
    if (!order) return;
    setActionLoading(true);
    try {
      await ordersApi.cancel(order.id);
      showToast('Заказ отменён', 'info');
      navigate('/shop');
    } catch (err: any) {
      showToast(err.response?.data?.detail || 'Ошибка', 'error');
      setActionLoading(false);
    }
  }

  if (loading) return <Loader />;
  if (!order) return null;

  return (
    <div className={`animate-fade-in ${styles.page}`}>
      <BackButton to="/shop" />
      <h1>Оплата</h1>

      <div className={`card ${styles.orderCard}`}>
        <div className={styles.orderHeader}>
          <span className={styles.orderId}>Заказ #{order.id}</span>
          <OrderBadge status={order.status} />
        </div>
        <div className={styles.amount}>{formatPrice(order.amount)}</div>
        <div className={styles.productName}>{order.product_name}</div>
      </div>

      {order.status === 'pending' && qr && (
        <>
          <div className={`card ${styles.qrCard}`}>
            <h2>Оплата через СБП</h2>
            <div className={styles.qrInfo}>
              <div className={styles.qrRow}>
                <span>Получатель:</span>
                <span className="neon-text-blue">{qr.recipient_name}</span>
              </div>
              <div className={styles.qrRow}>
                <span>Банк:</span>
                <span>{qr.bank_name}</span>
              </div>
              <div className={styles.qrRow}>
                <span>Сумма:</span>
                <span className="neon-text-pink">{formatPrice(qr.amount)}</span>
              </div>
            </div>

            <div className={styles.instructions}>
              <p>1. Нажмите кнопку "Открыть СБП"</p>
              <p>2. Переведите <strong>{formatPrice(qr.amount)}</strong></p>
              <p>3. Нажмите «Я оплатил»</p>
            </div>

            {qr.qr_sbp_link && (
              <a
                href={qr.qr_sbp_link}
                className="btn btn-secondary btn-block"
                target="_blank"
                rel="noreferrer"
              >
                Открыть СБП
              </a>
            )}
          </div>

          <button
            className="btn btn-primary btn-block"
            onClick={handleMarkPaid}
            disabled={actionLoading}
          >
            {actionLoading ? 'Отправка...' : '✓ Я оплатил'}
          </button>

          <button
            className="btn btn-danger btn-block"
            onClick={handleCancel}
            disabled={actionLoading}
          >
            Отменить заказ
          </button>
        </>
      )}

      {order.status === 'awaiting_confirmation' && (
        <div className={`card ${styles.waitingCard}`}>
          <div className={styles.waitingIcon}>⏳</div>
          <h2>Ожидайте подтверждения</h2>
          <p className={styles.waitingText}>
            Администратор проверит оплату и начислит кредиты.
            Обычно это занимает несколько минут.
          </p>
        </div>
      )}

      {order.status === 'confirmed' && (
        <div className={`card ${styles.successCard}`}>
          <div className={styles.successIcon}>✅</div>
          <h2>Оплата подтверждена!</h2>
          <p className={styles.successText}>
            {order.credits_count} кредитов начислено на ваш счёт.
          </p>
          <button
            className="btn btn-primary btn-block"
            onClick={() => navigate('/')}
          >
            На главную
          </button>
        </div>
      )}

      {order.status === 'rejected' && (
        <div className={`card ${styles.rejectCard}`}>
          <div className={styles.rejectIcon}>❌</div>
          <h2>Оплата отклонена</h2>
          <p className={styles.rejectText}>
            Причина: {order.reject_reason || 'Не указана'}
          </p>
          <button
            className="btn btn-secondary btn-block"
            onClick={() => navigate('/shop')}
          >
            Вернуться в магазин
          </button>
        </div>
      )}
    </div>
  );
}