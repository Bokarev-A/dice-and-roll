import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { sessionsApi } from '../../api/sessions';
import { signupsApi } from '../../api/signups';
import type { GameSession, Signup } from '../../types/index';
import { useUIStore } from '../../store/useUIStore';
import { SessionBadge, SignupBadge } from '../../components/UI/Badge';
import { Loader } from '../../components/UI/Loader';
import { Empty } from '../../components/UI/Empty';
import { BackButton } from '../../components/UI/BackButton';
import { formatDateTime } from '../../utils/format';
import styles from '../GM/GM.module.css';

export function SessionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const showToast = useUIStore((s) => s.showToast);
  const navigate = useNavigate();
  const sessionId = Number(id);

  const [session, setSession] = useState<GameSession | null>(null);
  const [mySignup, setMySignup] = useState<Signup | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  async function load() {
    try {
      const [s, signups] = await Promise.all([
        sessionsApi.getById(sessionId),
        signupsApi.my(),
      ]);
      setSession(s);
      const found = signups.find((sg) => sg.session_id === sessionId && sg.status !== 'cancelled');
      setMySignup(found ?? null);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [sessionId]);

  async function handleConfirm() {
    if (!mySignup) return;
    setActionLoading(true);
    try {
      await signupsApi.confirm(mySignup.id);
      showToast('Участие подтверждено!', 'success');
      await load();
    } catch (err: any) {
      showToast(err.response?.data?.detail || 'Ошибка', 'error');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleCancel() {
    if (!mySignup) return;
    setActionLoading(true);
    try {
      await signupsApi.cancel(mySignup.id);
      showToast('Запись отменена', 'info');
      await load();
    } catch (err: any) {
      showToast(err.response?.data?.detail || 'Ошибка', 'error');
    } finally {
      setActionLoading(false);
    }
  }

  if (loading) return <Loader />;
  if (!session) return <Empty icon="❌" title="Сессия не найдена" />;

  const isPending = mySignup?.status === 'pending';
  const canCancel = mySignup && (mySignup.status === 'confirmed' || mySignup.status === 'waitlist');

  return (
    <div className={`animate-fade-in ${styles.page}`}>
      <BackButton to={`/campaign/${session.campaign_id}`} />
      <div className={styles.pageHeader}>
        <h1>{session.campaign_title}</h1>
        <SessionBadge status={session.status} />
      </div>

      <div className={`card ${styles.sessionInfo}`}>
        {session.description && (
          <div className={styles.sessionDescription}>{session.description}</div>
        )}
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

      {mySignup && (
        <div className={`card ${styles.sessionInfo}`}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>Ваша запись:</span>
            <SignupBadge status={mySignup.status} />
          </div>
          {mySignup.status === 'waitlist' && (mySignup as any).waitlist_position && (
            <div style={{ marginTop: '6px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              Позиция в очереди: #{(mySignup as any).waitlist_position}
            </div>
          )}
        </div>
      )}

      <div className={styles.actions}>
        <button
          className="btn btn-secondary btn-sm"
          onClick={() => navigate(`/campaign/${session.campaign_id}`)}
        >
          К кампании
        </button>
        {isPending && (
          <>
            <button
              className="btn btn-primary btn-sm"
              onClick={handleConfirm}
              disabled={actionLoading}
            >
              Подтвердить
            </button>
            <button
              className="btn btn-danger btn-sm"
              onClick={handleCancel}
              disabled={actionLoading}
            >
              Отказаться
            </button>
          </>
        )}
        {canCancel && (
          <button
            className="btn btn-danger btn-sm"
            onClick={handleCancel}
            disabled={actionLoading}
          >
            Отменить запись
          </button>
        )}
      </div>
    </div>
  );
}
