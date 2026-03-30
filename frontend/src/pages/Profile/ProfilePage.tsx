import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/useAuthStore';
import { creditsApi } from '../../api/credits';
import { ordersApi } from '../../api/orders';
import type { CreditBalance, Order, LedgerEntry } from '../../types/index';
import { BalanceCard } from '../../components/Credit/BalanceCard';
import { OrderBadge } from '../../components/UI/Badge';
import { Loader } from '../../components/UI/Loader';
import { formatDate, formatDateTime, formatPrice, formatCredits } from '../../utils/format';
import styles from './ProfilePage.module.css';

type Tab = 'credits' | 'orders' | 'history';

export function ProfilePage() {
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('credits');
  const [balance, setBalance] = useState<CreditBalance | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [history, setHistory] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [b, o, h] = await Promise.all([
          creditsApi.balance(),
          ordersApi.myOrders(),
          creditsApi.history(),
        ]);
        setBalance(b);
        setOrders(o);
        setHistory(h);
      } catch {
        // silent
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) return <Loader />;

  const isGmOrAdmin = user?.role === 'gm' || user?.role === 'admin';
  const hasGmRewards = (balance?.total_gm_rewards || 0) > 0;

  return (
    <div className={`animate-fade-in ${styles.page}`}>
      {/* Profile header */}
      <div className={styles.profileHeader}>
        <div className={styles.avatar}>
          {user?.first_name?.charAt(0) || '?'}
        </div>
        <div className={styles.info}>
          <h1 className={styles.name}>
            {user?.first_name} {user?.last_name || ''}
          </h1>
          {user?.username && (
            <span className={styles.username}>@{user.username}</span>
          )}
          <span className={`badge badge-${user?.role === 'admin' ? 'pink' : user?.role === 'gm' ? 'purple' : 'blue'}`}>
            {user?.role === 'admin' ? 'Админ' : user?.role === 'gm' ? 'Мастер' : 'Игрок'}
          </span>
        </div>
      </div>

      {/* Balance */}
      <BalanceCard
        totalCredits={balance?.total_credits || 0}
        totalRentals={balance?.total_rentals || 0}
        totalGmRewards={balance?.total_gm_rewards || 0}
        showRentals={isGmOrAdmin}
        showGmRewards={isGmOrAdmin || hasGmRewards}
      />

      {/* Tabs */}
      <div className={styles.tabs}>
        {(['credits', 'orders', 'history'] as Tab[]).map((t) => (
          <button
            key={t}
            className={`${styles.tab} ${tab === t ? styles.tabActive : ''}`}
            onClick={() => setTab(t)}
          >
            {t === 'credits' ? 'Кредиты' : t === 'orders' ? 'Заказы' : 'История'}
          </button>
        ))}
      </div>

      {/* Credits tab */}
      {tab === 'credits' && balance && (
        <div className={styles.list}>
          <h3 className={styles.sectionTitle}>
            <span className={styles.emoji}>💎</span> КРЕДИТЫ
          </h3>
          {balance.credit_batches.length === 0 ? (
            <p className={styles.empty}>Нет активных кредитов</p>
          ) : (
            balance.credit_batches.map((b) => (
              <div key={b.id} className={`card ${styles.batchCard}`}>
                <div className={styles.batchHeader}>
                  <span className={styles.batchCredits}>
                    {b.remaining}/{b.total}
                  </span>
                  <span className={`badge badge-${b.status === 'active' ? 'green' : 'orange'}`}>
                    {b.status}
                  </span>
                </div>
                <div className={styles.batchMeta}>
                  Куплено: {formatDate(b.purchased_at)}
                  {b.expires_at && (
                    <> · Истекает: {formatDate(b.expires_at)}</>
                  )}
                </div>
              </div>
            ))
          )}

          {isGmOrAdmin && (
            <>
              <h3 className={styles.sectionTitle}>
                <span className={styles.emoji}>🏠</span> АРЕНДЫ
              </h3>
              {balance.rental_batches.length === 0 ? (
                <p className={styles.empty}>Нет активных аренд</p>
              ) : (
                balance.rental_batches.map((b) => (
                  <div key={b.id} className={`card ${styles.batchCard}`}>
                    <div className={styles.batchHeader}>
                      <span className={styles.batchCredits}>
                        {b.remaining}/{b.total}
                      </span>
                      <span className={`badge badge-${b.status === 'active' ? 'green' : 'orange'}`}>
                        {b.status}
                      </span>
                    </div>
                    <div className={styles.batchMeta}>
                      Куплено: {formatDate(b.purchased_at)}
                      {b.expires_at && (
                        <> · Истекает: {formatDate(b.expires_at)}</>
                      )}
                    </div>
                  </div>
                ))
              )}
            </>
          )}

          {(isGmOrAdmin || hasGmRewards) && (
            <>
              <h3 className={styles.sectionTitle}>
                <span className={styles.emoji}>⭐</span> МАСТЕРСКИЕ КРЕДИТЫ
              </h3>
              {balance.gm_reward_batches.length === 0 ? (
                <p className={styles.empty}>Нет мастерских кредитов</p>
              ) : (
                balance.gm_reward_batches.map((b) => (
                  <div key={b.id} className={`card ${styles.batchCard}`}>
                    <div className={styles.batchHeader}>
                      <span className={styles.batchCredits}>
                        {b.remaining}/{b.total}
                      </span>
                      <span className={`badge badge-${b.status === 'active' ? 'green' : 'orange'}`}>
                        {b.status}
                      </span>
                    </div>
                    <div className={styles.batchMeta}>
                      Получено: {formatDate(b.purchased_at)}
                      <> · За проведённую сессию</>
                    </div>
                  </div>
                ))
              )}
            </>
          )}

          <button
            className="btn btn-primary btn-block"
            onClick={() => navigate('/shop')}
          >
            💎 Купить ещё
          </button>
        </div>
      )}

      {/* Orders tab */}
      {tab === 'orders' && (
        <div className={styles.list}>
          {orders.length === 0 ? (
            <p className={styles.empty}>Нет заказов</p>
          ) : (
            orders.map((o) => (
              <div
                key={o.id}
                className={`card ${styles.orderCard}`}
                onClick={() =>
                  o.status === 'pending' || o.status === 'awaiting_confirmation'
                    ? navigate(`/shop/pay/${o.id}`)
                    : undefined
                }
              >
                <div className={styles.orderHeader}>
                  <span className={styles.orderNum}>#{o.id}</span>
                  <OrderBadge status={o.status} />
                </div>
                <div className={styles.orderAmount}>
                  {formatPrice(o.amount)}
                </div>
                <div className={styles.orderMeta}>
                  {formatCredits(o.credits_count)} · {formatDate(o.created_at)}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* History tab */}
      {tab === 'history' && (
        <div className={styles.list}>
          {history.length === 0 ? (
            <p className={styles.empty}>Нет транзакций</p>
          ) : (
            history.map((h) => (
              <div key={h.id} className={`card ${styles.historyCard}`}>
                <div className={styles.historyHeader}>
                  <span className={
                    h.entry_type === 'debit' ? styles.debit :
                    h.entry_type === 'gm_reward' ? styles.gmReward :
                    styles.refund
                  }>
                    {h.entry_type === 'debit' ? '−1' :
                     h.entry_type === 'gm_reward' ? '⭐+1' : '+1'}
                  </span>
                  <span className={styles.historyDate}>
                    {formatDateTime(h.created_at)}
                  </span>
                </div>
                {h.description && (
                  <div className={styles.historyDesc}>{h.description}</div>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
