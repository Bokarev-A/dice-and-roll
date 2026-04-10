import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/useAuthStore';
import { creditsApi } from '../../api/credits';
import { calendarApi } from '../../api/calendar';
import { signupsApi } from '../../api/signups';
import type { CreditBalance, CalendarEntry, Signup } from '../../types/index';
import { BalanceCard } from '../../components/Credit/BalanceCard';
import { Loader } from '../../components/UI/Loader';
import { Empty } from '../../components/UI/Empty';
import { formatDate, formatTime } from '../../utils/format';
import { SignupBadge } from '../../components/UI/Badge';
import { useUIStore } from '../../store/useUIStore';
import styles from './HomePage.module.css';

export function HomePage() {
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();
  const showToast = useUIStore((s) => s.showToast);
  const [balance, setBalance] = useState<CreditBalance | null>(null);
  const [sessions, setSessions] = useState<CalendarEntry[]>([]);
  const [mySignups, setMySignups] = useState<Record<number, Signup>>({});
  const [loading, setLoading] = useState(true);

  async function load() {
    try {
      const [b, s, signups] = await Promise.all([
        creditsApi.balance(),
        calendarApi.my(),
        signupsApi.my(),
      ]);
      setBalance(b);
      setSessions(s.slice(0, 5));
      const map: Record<number, Signup> = {};
      signups.forEach((sg) => { map[sg.session_id] = sg; });
      setMySignups(map);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleConfirm(sessionId: number) {
    const signup = mySignups[sessionId];
    if (!signup) return;
    try {
      await signupsApi.confirm(signup.id);
      showToast('Участие подтверждено!', 'success');
      await load();
    } catch {
      showToast('Не удалось подтвердить', 'error');
    }
  }

  async function handleDecline(sessionId: number) {
    const signup = mySignups[sessionId];
    if (!signup) return;
    try {
      await signupsApi.cancel(signup.id);
      showToast('Отказано', 'info');
      await load();
    } catch {
      showToast('Не удалось отказаться', 'error');
    }
  }

  if (loading) return <Loader />;

  return (
    <div className={`animate-fade-in ${styles.page}`}>
      {/* Header */}
      <div className={styles.header}>
        <h1>Dice & Roll</h1>
        <p className={styles.greeting}>
          Привет, <span className="neon-text-pink">{user?.first_name}</span>!
        </p>
      </div>

      {/* Balance */}
      <BalanceCard
        totalCredits={balance?.total_credits || 0}
        totalRentals={balance?.total_rentals || 0}
        totalGmRewards={balance?.total_gm_rewards || 0}
        showRentals={user?.role === 'gm' || user?.role === 'admin'}
        showGmRewards={(user?.role === 'gm' || user?.role === 'admin') || (balance?.total_gm_rewards || 0) > 0}
        onClick={() => navigate('/profile')}
      />

      {/* Upcoming sessions */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2>Ближайшие сессии</h2>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => navigate('/my-sessions')}
          >
            Все
          </button>
        </div>

        {sessions.length === 0 ? (
          <Empty
            icon="📅"
            title="Нет ближайших сессий"
            subtitle="Запишитесь на сессию в каталоге"
          />
        ) : (
          <div className={styles.sessionList}>
            {sessions.map((entry) => (
              <div
                key={entry.session_id}
                className={`card ${styles.sessionCard}`}
                onClick={() => navigate(entry.is_gm ? `/gm/sessions/${entry.session_id}` : `/sessions/${entry.session_id}`)}
              >
                <div className={styles.sessionTop}>
                  <div className={styles.sessionDate}>
                    <span className={styles.sessionDay}>
                      {formatDate(entry.starts_at)}
                    </span>
                    <span className={styles.sessionTime}>
                      {formatTime(entry.starts_at)}
                    </span>
                  </div>
                  {entry.is_gm ? (
                    <span className="badge badge-purple">🎲 ГМ</span>
                  ) : entry.signup_status ? (
                    <SignupBadge status={entry.signup_status} />
                  ) : null}
                </div>
                <div className={styles.sessionTitle}>
                  {entry.campaign_title}
                </div>
                {entry.description && (
                  <div className={styles.sessionDescription}>
                    {entry.description}
                  </div>
                )}
                <div className={styles.sessionMeta}>
                  🚪 {entry.room_name} · 👥 {entry.confirmed_count}/{entry.capacity}
                </div>

                {entry.signup_status === 'pending' && (
                  <div
                    style={{ display: 'flex', gap: '8px', marginTop: '8px' }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => handleConfirm(entry.session_id)}
                    >
                      Подтвердить
                    </button>
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={() => handleDecline(entry.session_id)}
                    >
                      Отказаться
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quick actions */}
      <div className={styles.actions}>
        <button
          className="btn btn-primary btn-block"
          onClick={() => navigate('/catalog')}
        >
          🎲 Найти игру
        </button>
        <button
          className="btn btn-secondary btn-block"
          onClick={() => navigate('/shop')}
        >
          💎 Купить кредиты
        </button>
      </div>
    </div>
  );
}
