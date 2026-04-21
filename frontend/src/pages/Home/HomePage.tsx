import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/useAuthStore';
import { creditsApi } from '../../api/credits';
import { calendarApi } from '../../api/calendar';
import { signupsApi } from '../../api/signups';
import { sessionsApi } from '../../api/sessions';
import type { CreditBalance, CalendarEntry, Signup, RoomMonthlyStats } from '../../types/index';
import { BalanceCard } from '../../components/Credit/BalanceCard';
import { Loader } from '../../components/UI/Loader';
import { Empty } from '../../components/UI/Empty';
import { formatDateWithDay, formatTime } from '../../utils/format';
import { SignupBadge } from '../../components/UI/Badge';
import { useUIStore } from '../../store/useUIStore';
import styles from './HomePage.module.css';

const MONTH_NAMES = [
  'январь', 'февраль', 'март', 'апрель', 'май', 'июнь',
  'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь',
];

export function HomePage() {
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();
  const showToast = useUIStore((s) => s.showToast);
  const isAdmin = user?.role === 'admin';

  const [balance, setBalance] = useState<CreditBalance | null>(null);
  const [sessions, setSessions] = useState<CalendarEntry[]>([]);
  const [mySignups, setMySignups] = useState<Record<number, Signup>>({});
  const [adminStats, setAdminStats] = useState<RoomMonthlyStats[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    try {
      if (isAdmin) {
        const [stats, s] = await Promise.all([
          sessionsApi.adminMonthlyStats(),
          calendarApi.my(),
        ]);
        setAdminStats(stats);
        setSessions(s.slice(0, 5));
      } else {
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
      }
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

      {isAdmin ? (
        /* Admin: monthly stats per room + upcoming sessions */
        <>
          <div className={styles.section}>
            <h2>
              Статистика за {MONTH_NAMES[new Date().getMonth()]} {new Date().getFullYear()}
            </h2>
            {adminStats.length === 0 ? (
              <Empty icon="📊" title="Нет данных" />
            ) : (
              <div className={styles.statsList}>
                {adminStats.map((s) => (
                  <div key={s.room_id} className={`card ${styles.statsCard}`}>
                    <span className={styles.statsRoomName}>{s.room_name}</span>
                    <div className={styles.statsMetrics}>
                      <span className={styles.statsMetric}>
                        <span className={styles.statsLbl}>сессий</span>
                        <span className={styles.statsNum}>{s.sessions_done}</span>
                      </span>
                      <span className={styles.statsDivider} />
                      <span className={styles.statsMetric}>
                        <span className={styles.statsNum}>{s.credits_spent}</span>
                        <span className={styles.statsLbl}>💎</span>
                      </span>
                      <span className={styles.statsDivider} />
                      <span className={styles.statsMetric}>
                        <span className={styles.statsNum}>{s.rentals_spent}</span>
                        <span className={styles.statsLbl}>🏠</span>
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

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
              <Empty icon="📅" title="Нет ближайших сессий" />
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
                        <span className={styles.sessionDay}>{formatDateWithDay(entry.starts_at)}</span>
                        <span className={styles.sessionTime}>{formatTime(entry.starts_at)}</span>
                      </div>
                    </div>
                    <div className={styles.sessionTitle}>{entry.campaign_title}</div>
                    {entry.system && (
                      <div className={styles.sessionSystem}>{entry.system}</div>
                    )}
                    <div className={styles.sessionMeta}>
                      🚪 {entry.room_name} · 👥 {entry.confirmed_count}/{entry.capacity}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      ) : (
        <>
          {/* Balance */}
          <BalanceCard
            totalCredits={balance?.total_credits || 0}
            totalRentals={balance?.total_rentals || 0}
            totalGmRewards={balance?.total_gm_rewards || 0}
            showRentals={user?.role === 'private_gm'}
            showGmRewards={user?.role === 'gm' || user?.role === 'admin'}
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
                          {formatDateWithDay(entry.starts_at)}
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
                    {entry.system && (
                      <div className={styles.sessionSystem}>{entry.system}</div>
                    )}
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
        </>
      )}

      {/* Quick actions */}
      {!isAdmin && (
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
      )}
    </div>
  );
}
