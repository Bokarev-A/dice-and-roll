import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { calendarApi } from '../../api/calendar';
import { signupsApi } from '../../api/signups';
import type { CalendarEntry } from '../../types/index';
import { Loader } from '../../components/UI/Loader';
import { Empty } from '../../components/UI/Empty';
import { SignupBadge } from '../../components/UI/Badge';
import { formatDate, formatTime } from '../../utils/format';
import { useUIStore } from '../../store/useUIStore';
import styles from './MySessionsPage.module.css';

export function MySessionsPage() {
  const navigate = useNavigate();
  const showToast = useUIStore((s) => s.showToast);
  const [sessions, setSessions] = useState<CalendarEntry[]>([]);
  const [mySignups, setMySignups] = useState<Record<number, number>>({});
  const [loading, setLoading] = useState(true);

  async function load() {
    try {
      const [cal, signups] = await Promise.all([
        calendarApi.my(),
        signupsApi.my(),
      ]);
      setSessions(cal);

      const map: Record<number, number> = {};
      signups.forEach((s) => {
        map[s.session_id] = s.id;
      });
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

  async function handleCancel(sessionId: number) {
    const signupId = mySignups[sessionId];
    if (!signupId) return;

    try {
      await signupsApi.cancel(signupId);
      showToast('Запись отменена', 'success');
      await load();
    } catch {
      showToast('Не удалось отменить', 'error');
    }
  }

  if (loading) return <Loader />;

  return (
    <div className={`animate-fade-in ${styles.page}`}>
      <h1>Мои сессии</h1>

      {sessions.length === 0 ? (
        <Empty
          icon="📅"
          title="Нет записей"
          subtitle="Запишитесь на игру в каталоге"
        />
      ) : (
        <div className={styles.list}>
          {sessions.map((entry) => (
            <div key={entry.session_id} className={`card ${styles.card}`}>
              <div className={styles.cardHeader}>
                <div className={styles.dateBlock}>
                  <span className={styles.date}>
                    {formatDate(entry.starts_at)}
                  </span>
                  <span className={styles.time}>
                    {formatTime(entry.starts_at)} — {formatTime(entry.ends_at)}
                  </span>
                </div>
                {entry.signup_status && (
                  <SignupBadge status={entry.signup_status} />
                )}
              </div>

              <div
                className={styles.title}
                onClick={() => navigate(`/campaign/${entry.campaign_id}`)}
              >
                {entry.campaign_title}
              </div>

              <div className={styles.meta}>
                🚪 {entry.room_name} · 👥 {entry.confirmed_count}/{entry.capacity}
              </div>

              {(entry.signup_status === 'confirmed' ||
                entry.signup_status === 'waitlist') && (
                <button
                  className="btn btn-danger btn-sm"
                  style={{ marginTop: '10px' }}
                  onClick={() => handleCancel(entry.session_id)}
                >
                  Отменить запись
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}