import { useEffect, useRef, useState } from 'react';
import { ordersApi } from '../../api/orders';
import type { Order } from '../../types/index';
import { useUIStore } from '../../store/useUIStore';
import { OrderBadge } from '../../components/UI/Badge';
import { Loader } from '../../components/UI/Loader';
import { Empty } from '../../components/UI/Empty';
import { formatPrice, formatDateTime, formatCredits } from '../../utils/format';
import styles from './Admin.module.css';

type Tab = 'pending' | 'all';

export function OrdersPage() {
  const showToast = useUIStore((s) => s.showToast);
  const [tab, setTab] = useState<Tab>('pending');
  const [orders, setOrders] = useState<Order[]>([]);
  const [pendingCount, setPendingCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [rejectId, setRejectId] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [actionOrderId, setActionOrderId] = useState<number | null>(null);
  const actionInProgress = useRef(false);

  async function load() {
    setLoading(true);
    try {
      if (tab === 'pending') {
        const data = await ordersApi.listPending();
        setOrders(data);
        setPendingCount(data.length);
      } else {
        const [all, pending] = await Promise.all([
          ordersApi.listAll(),
          ordersApi.listPending(),
        ]);
        setOrders(all);
        setPendingCount(pending.length);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [tab]);

  async function handleConfirm(orderId: number) {
    if (actionInProgress.current) return;
    actionInProgress.current = true;
    setActionOrderId(orderId);
    try {
      await ordersApi.confirm(orderId);
      showToast('Оплата подтверждена!', 'success');
    } catch (err: any) {
      showToast(err.response?.data?.detail || 'Ошибка', 'error');
    } finally {
      actionInProgress.current = false;
      setActionOrderId(null);
      await load();
    }
  }

  async function handleReject(orderId: number) {
    if (!rejectReason.trim()) {
      showToast('Укажите причину', 'error');
      return;
    }
    if (actionInProgress.current) return;
    actionInProgress.current = true;
    setActionOrderId(orderId);
    try {
      await ordersApi.reject(orderId, rejectReason.trim());
      showToast('Оплата отклонена', 'info');
      setRejectId(null);
      setRejectReason('');
    } catch (err: any) {
      showToast(err.response?.data?.detail || 'Ошибка', 'error');
    } finally {
      actionInProgress.current = false;
      setActionOrderId(null);
      await load();
    }
  }

  async function handleDelete(orderId: number) {
    if (actionInProgress.current) return;
    actionInProgress.current = true;
    setActionOrderId(orderId);
    try {
      await ordersApi.delete(orderId);
      showToast('Заказ удалён', 'info');
      setDeleteId(null);
    } catch (err: any) {
      showToast(err.response?.data?.detail || 'Ошибка', 'error');
    } finally {
      actionInProgress.current = false;
      setActionOrderId(null);
      await load();
    }
  }

  return (
    <div className={`animate-fade-in ${styles.page}`}>
      <h1>Оплаты</h1>

      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${tab === 'pending' ? styles.tabActive : ''}`}
          onClick={() => setTab('pending')}
        >
          Ожидают ({pendingCount !== null ? pendingCount : '...'})
        </button>
        <button
          className={`${styles.tab} ${tab === 'all' ? styles.tabActive : ''}`}
          onClick={() => setTab('all')}
        >
          Все
        </button>
      </div>

      {loading ? (
        <Loader />
      ) : orders.length === 0 ? (
        <Empty
          icon="💳"
          title={tab === 'pending' ? 'Нет ожидающих оплат' : 'Нет заказов'}
        />
      ) : (
        <div className={styles.list}>
          {orders.map((order) => (
            <div key={order.id} className={`card ${styles.orderCard}`}>
              <div className={styles.orderHeader}>
                <span className={styles.orderId}>#{order.id}</span>
                <OrderBadge status={order.status} />
              </div>

              <div className={styles.orderDetails}>
                <div className={styles.orderRow}>
                  <span>Игрок:</span>
                  <span>{order.user_name || `#${order.user_id}`}</span>
                </div>
                <div className={styles.orderRow}>
                  <span>Сумма:</span>
                  <span className="neon-text-pink">{formatPrice(order.amount)}</span>
                </div>
                <div className={styles.orderRow}>
                  <span>Кредиты:</span>
                  <span>{formatCredits(order.credits_count)}</span>
                </div>

                <div className={styles.orderRow}>
                  <span>Создан:</span>
                  <span>{formatDateTime(order.created_at)}</span>
                </div>
                {order.paid_at && (
                  <div className={styles.orderRow}>
                    <span>Оплачен:</span>
                    <span>{formatDateTime(order.paid_at)}</span>
                  </div>
                )}
              </div>

              {order.status === 'awaiting_confirmation' && (
                <div className={styles.orderActions}>
                  <button
                    className="btn btn-success btn-sm"
                    onClick={() => handleConfirm(order.id)}
                    disabled={actionOrderId !== null}
                  >
                    {actionOrderId === order.id ? '...' : '✓ Подтвердить'}
                  </button>
                  <button
                    className="btn btn-danger btn-sm"
                    onClick={() => setRejectId(
                      rejectId === order.id ? null : order.id
                    )}
                    disabled={actionOrderId !== null}
                  >
                    ✕ Отклонить
                  </button>
                </div>
              )}

              {rejectId === order.id && (
                <div className={styles.rejectForm}>
                  <input
                    className="input"
                    placeholder="Причина отклонения..."
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                  />
                  <button
                    className="btn btn-danger btn-sm"
                    onClick={() => handleReject(order.id)}
                    disabled={actionOrderId !== null}
                  >
                    {actionOrderId === order.id ? '...' : 'Отклонить'}
                  </button>
                </div>
              )}

              {order.reject_reason && (
                <div className={styles.rejectNote}>
                  Причина: {order.reject_reason}
                </div>
              )}

              {tab === 'all' && deleteId !== order.id && (
                <button
                  className="btn btn-danger btn-sm"
                  style={{ alignSelf: 'flex-end' }}
                  onClick={() => setDeleteId(order.id)}
                  disabled={actionOrderId !== null}
                >
                  Удалить
                </button>
              )}

              {tab === 'all' && deleteId === order.id && (
                <div className={styles.deleteConfirm}>
                  <span className={styles.deleteConfirmText}>Удалить заказ #{order.id}?</span>
                  <div className={styles.deleteConfirmActions}>
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={() => handleDelete(order.id)}
                      disabled={actionOrderId !== null}
                    >
                      {actionOrderId === order.id ? '...' : 'Да, удалить'}
                    </button>
                    <button
                      className="btn btn-sm"
                      onClick={() => setDeleteId(null)}
                      disabled={actionOrderId !== null}
                    >
                      Отмена
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}