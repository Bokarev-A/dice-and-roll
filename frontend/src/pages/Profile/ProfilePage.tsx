import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/useAuthStore';
import { creditsApi } from '../../api/credits';
import { ordersApi } from '../../api/orders';
import { sessionsApi } from '../../api/sessions';
import type { CreditBalance, Order, LedgerEntry, GmMonthlyStats } from '../../types/index';
import { BalanceCard } from '../../components/Credit/BalanceCard';
import { OrderBadge } from '../../components/UI/Badge';
import { Loader } from '../../components/UI/Loader';
import { formatDate, formatDateWithDay, formatDateTime, formatPrice, formatCredits } from '../../utils/format';
import styles from './ProfilePage.module.css';

type Tab = 'credits' | 'orders' | 'history' | 'sessions';

const MONTH_NAMES = [
  'январь', 'февраль', 'март', 'апрель', 'май', 'июнь',
  'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь',
];

export function ProfilePage() {
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();
  const isGM = user?.role === 'gm' || user?.role === 'private_gm' || user?.role === 'admin';
  const [tab, setTab] = useState<Tab>(isGM ? 'sessions' : 'credits');
  const [balance, setBalance] = useState<CreditBalance | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [history, setHistory] = useState<LedgerEntry[]>([]);
  const [gmStats, setGmStats] = useState<GmMonthlyStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const requests: Promise<any>[] = [
          creditsApi.balance(),
          ordersApi.myOrders(),
          creditsApi.history(),
        ];
        if (isGM) requests.push(sessionsApi.gmMonthlyStats());

        const [b, o, h, gm] = await Promise.all(requests);
        setBalance(b);
        setOrders(o);
        setHistory(h);
        if (gm) setGmStats(gm);
      } catch {
        // silent
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) return <Loader />;

  const showRentals = user?.role === 'private_gm' || user?.role === 'admin';
  const showGmRewards = user?.role === 'gm' || user?.role === 'admin';
  const now = new Date();
  const monthLabel = `${MONTH_NAMES[now.getMonth()]} ${now.getFullYear()}`;

  return (
    <div className={`animate-fade-in ${styles.page}`}>
      {/* Profile header */}
      <div className={styles.profileHeader}>
        <div className={styles.avatar}>
          {user?.photo_url ? (
            <img
              src={user.photo_url}
              alt={user.first_name}
              style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }}
            />
          ) : (
            user?.first_name?.charAt(0) || '?'
          )}
        </div>
        <div className={styles.info}>
          <h1 className={styles.name}>
            {user?.first_name} {user?.last_name || ''}
          </h1>
          {user?.username && (
            <span className={styles.username}>@{user.username}</span>
          )}
          <span className={`badge badge-${user?.role === 'admin' ? 'pink' : user?.role === 'gm' ? 'purple' : user?.role === 'private_gm' ? 'teal' : 'blue'}`}>
            {user?.role === 'admin' ? 'Админ' : user?.role === 'gm' ? 'Мастер' : user?.role === 'private_gm' ? 'Частный ГМ' : 'Игрок'}
          </span>
        </div>
      </div>

      {/* Balance */}
      <BalanceCard
        totalCredits={balance?.total_credits || 0}
        totalRentals={balance?.total_rentals || 0}
        totalGmRewards={balance?.total_gm_rewards || 0}
        showRentals={showRentals}
        showGmRewards={showGmRewards}
      />

      {/* Tabs */}
      <div className={styles.tabs}>
        {isGM && (
          <button
            className={`${styles.tab} ${tab === 'sessions' ? styles.tabActive : ''}`}
            onClick={() => setTab('sessions')}
          >
            Сессии
          </button>
        )}
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

      {/* Sessions tab (GM only) */}
      {tab === 'sessions' && isGM && (
        <div className={styles.list}>
          <h3 className={styles.sectionTitle}>
            <span className={styles.emoji}>🎲</span> {monthLabel.toUpperCase()}
          </h3>

          {gmStats && (gmStats.campaigns_count > 0 || gmStats.oneshots_count > 0) && (
            <div className={`card ${styles.gmStatsSummary}`}>
              {gmStats.campaigns_count > 0 && (
                <span>📜 Кампаний: <strong>{gmStats.campaigns_count}</strong></span>
              )}
              {gmStats.oneshots_count > 0 && (
                <span>⚡ Ваншотов: <strong>{gmStats.oneshots_count}</strong></span>
              )}
            </div>
          )}

          {!gmStats || gmStats.sessions.length === 0 ? (
            <p className={styles.empty}>В этом месяце сессий не проводилось</p>
          ) : (
            gmStats.sessions.map((s) => (
              <div key={s.session_id} className={`card ${styles.gmSessionCard}`}>
                <div className={styles.gmSessionHeader}>
                  <span className={styles.gmSessionTitle}>{s.campaign_title}</span>
                  <span className={`badge ${s.campaign_type === 'campaign' ? 'badge-purple' : 'badge-blue'}`}>
                    {s.campaign_type === 'campaign' ? 'Кампания' : 'Ваншот'}
                  </span>
                </div>
                {s.system && (
                  <div className={styles.gmSessionSystem}>{s.system}</div>
                )}
                <div className={styles.gmSessionMeta}>
                  <span>📅 {formatDateWithDay(s.starts_at)}</span>
                  <span>👥 {s.attendees_count} игр.</span>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Credits tab */}
      {tab === 'credits' && balance && (
        <div className={styles.list}>
          <h3 className={styles.sectionTitle}>
            <span className={styles.emoji}>💎</span> КРЕДИТЫ
          </h3>
          {balance.credit_batches.filter((b) => b.remaining > 0).length === 0 &&
           !balance.credit_batches.some((b) => b.remaining < 0) ? (
            <p className={styles.empty}>Нет активных кредитов</p>
          ) : (
            balance.credit_batches.map((b) => {
              const isDebt = b.remaining < 0;
              return (
                <div key={b.id} className={`card ${isDebt ? styles.debtCard : styles.batchCard}`}>
                  <div className={styles.batchHeader}>
                    <span className={isDebt ? styles.debtCredits : styles.batchCredits}>
                      {isDebt ? `Долг: ${Math.abs(b.remaining)} кр.` : `${b.remaining}/${b.total}`}
                    </span>
                    <span className={`badge ${isDebt ? 'badge-red' : `badge-${b.status === 'active' ? 'green' : 'orange'}`}`}>
                      {isDebt ? 'долг' : b.status}
                    </span>
                  </div>
                  {!isDebt && (
                    <div className={styles.batchMeta}>
                      Куплено: {formatDate(b.purchased_at)}
                      {b.expires_at && (
                        <> · Истекает: {formatDate(b.expires_at)}</>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}

          {showRentals && (
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

          {showGmRewards && (
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
