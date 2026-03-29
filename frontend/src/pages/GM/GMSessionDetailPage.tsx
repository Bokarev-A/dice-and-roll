import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { sessionsApi } from '../../api/sessions';
import { signupsApi } from '../../api/signups';
import type { GameSession, Signup } from '../../types/index';
import { useUIStore } from '../../store/useUIStore';
import { SessionBadge, SignupBadge } from '../../components/UI/Badge';
import { Loader } from '../../components/UI/Loader';
import { Empty } from '../../components/UI/Empty';
import { formatDateTime } from '../../utils/format';
import styles from './GM.module.css';

export function GMSessionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const showToast = useUIStore((s) => s.showToast);
  const sessionId = Number(id);

  const [session, setSession] = useState<GameSession | null>(null);
  const [signups, setSignups] = useState<Signup[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    try {
      const [s, sg] = await Promise.all([
        sessionsApi.getById(sessionId),
        signupsApi.listBySession(sessionId),
      ]);
      setSession(s);
      setSignups(sg);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [sessionId]);

  async function handleAction(signupId: number, action: 'approve' | 'reject') {
    try {
      await signupsApi.action(signupId, action);
      showToast(action === 'approve' ? 'Одобрено!' : 'Отклонено', 'success');
      await load();
    } catch (err: any) {
      showToast(err.response?.data?.detail || 'Ошибка', 'error');
    }
  }

  async function handleRemove(signupId: number) {
    try {
      await signupsApi.remove(signupId);
      showToast('Игрок удалён', 'info');
      await load();
    } catch (err: any) {
      showToast(err.response?.data?.detail || 'Ошибка', 'error');
    }
  }

  async function handleCancel() {
    try {
      await sessionsApi.update(sessionId, { status: 'canceled' });
      showToast('Сессия отменена', 'info');
      await load();
    } catch (err: any) {
      showToast(err.response?.data?.detail || 'Ошибка', 'error');
    }
  }

  if (loading) return <Loader />;
  if (!session) return <Empty icon="❌" title="Сессия не найдена" />;

  const activeSignups = signups.filter((s) => s.status !== 'cancelled');

  return (
    <div className={`animate-fade-in ${styles.page}`}>
      <div className={styles.pageHeader}>
        <h1>{session.campaign_title}</h1>
        <SessionBadge status={session.status} />
      </div>

      <div className={`card ${styles.sessionInfo}`}>
        <div className={styles.infoRow}>
          <span>📅</span>
          <span>{formatDateTime(session.starts_at)} — {formatDateTime(session.ends_at)}</span>
        </div>
        <div className={styles.infoRow}>
          <span>🚪</span>
          <span>{session.room_name}</span>
        </div>
        <div className={styles.infoRow}>
          <span>👥</span>
          <span>{session.confirmed_count}/{session.capacity} подтверждено</span>
        </div>
        {session.waitlist_count > 0 && (
          <div className={styles.infoRow}>
            <span>⏳</span>
            <span>{session.waitlist_count} в ожидании</span>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className={styles.actions}>
        <button
          className="btn btn-secondary btn-sm"
          onClick={() => navigate(`/gm/attendance/${session.id}`)}
        >
          📝 Посещаемость
        </button>
        {session.status !== 'canceled' && session.status !== 'done' && (
          <button className="btn btn-danger btn-sm" onClick={handleCancel}>
            🚫 Отменить
          </button>
        )}
      </div>

      <hr className="divider" />

      {/* Signups */}
      <h2>Записи ({activeSignups.length})</h2>
      {activeSignups.length === 0 ? (
        <Empty icon="👥" title="Нет записей" />
      ) : (
        <div className={styles.list}>
          {activeSignups.map((signup) => (
            <div key={signup.id} className={`card ${styles.signupCard}`}>
              <div className={styles.signupHeader}>
                <span className={styles.signupUser}>
                  Игрок #{signup.user_id}
                </span>
                <SignupBadge status={signup.status} />
              </div>

              {signup.status === 'waitlist' && signup.waitlist_position && (
                <div className={styles.waitlistPos}>
                  Позиция: #{signup.waitlist_position}
                </div>
              )}

              <div className={styles.signupActions}>
                {signup.status === 'offered' && (
                  <>
                    <button
                      className="btn btn-success btn-sm"
                      onClick={() => handleAction(signup.id, 'approve')}
                    >
                      ✓ Одобрить
                    </button>
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={() => handleAction(signup.id, 'reject')}
                    >
                      ✕ Отклонить
                    </button>
                  </>
                )}
                {(signup.status === 'confirmed' || signup.status === 'waitlist') && (
                  <button
                    className="btn btn-danger btn-sm"
                    onClick={() => handleRemove(signup.id)}
                  >
                    Удалить
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}