import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { BackButton } from '../../components/UI/BackButton';
import { attendanceApi } from '../../api/attendance';
import { sessionsApi } from '../../api/sessions';
import type { Attendance, AttendanceStatus, GameSession } from '../../types/index';
import { useUIStore } from '../../store/useUIStore';
import { AttendanceBadge } from '../../components/UI/Badge';
import { Loader } from '../../components/UI/Loader';
import { Empty } from '../../components/UI/Empty';
import { formatDateTime } from '../../utils/format';
import styles from './GM.module.css';

const STATUS_OPTIONS: { value: AttendanceStatus; label: string; icon: string }[] = [
  { value: 'attended', label: 'Был', icon: '✅' },
  { value: 'no_show', label: 'Не пришёл', icon: '❌' },
  { value: 'excused', label: 'Уважительная', icon: '📋' },
];

export function AttendancePage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const showToast = useUIStore((s) => s.showToast);
  const sid = Number(sessionId);

  const [session, setSession] = useState<GameSession | null>(null);
  const [attendances, setAttendances] = useState<Attendance[]>([]);
  const [loading, setLoading] = useState(true);
  const [initialized, setInitialized] = useState(false);
  const [markingUserId, setMarkingUserId] = useState<number | null>(null);

  async function load() {
    try {
      const s = await sessionsApi.getById(sid);
      setSession(s);

      const att = await attendanceApi.listBySession(sid);
      setAttendances(att);
      setInitialized(att.length > 0);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [sid]);

  async function handleInit() {
    try {
      await attendanceApi.init(sid);
      showToast('Посещаемость инициализирована', 'success');
      await load();
    } catch (err: any) {
      showToast(err.response?.data?.detail || 'Ошибка', 'error');
    }
  }

  async function handleMark(userId: number, status: AttendanceStatus) {
    if (markingUserId !== null) return;
    setMarkingUserId(userId);
    try {
      await attendanceApi.mark(sid, userId, status);
      showToast('Отмечено!', 'success');
      await load();
    } catch (err: any) {
      showToast(err.response?.data?.detail || 'Ошибка', 'error');
    } finally {
      setMarkingUserId(null);
    }
  }

  async function handleRefund(userId: number) {
    try {
      await attendanceApi.refund(sid, userId);
      showToast('Кредит возвращён', 'success');
      await load();
    } catch (err: any) {
      showToast(err.response?.data?.detail || 'Ошибка', 'error');
    }
  }

  if (loading) return <Loader />;
  if (!session) return <Empty icon="❌" title="Сессия не найдена" />;

  return (
    <div className={`animate-fade-in ${styles.page}`}>
      <BackButton />
      <h1>Посещаемость</h1>

      <div className={`card ${styles.sessionInfo}`}>
        <div className={styles.infoRow}>
          <span>🎲</span>
          <span>{session.campaign_title}</span>
        </div>
        <div className={styles.infoRow}>
          <span>📅</span>
          <span>{formatDateTime(session.starts_at)}</span>
        </div>
        <div className={styles.infoRow}>
          <span>🚪</span>
          <span>{session.room_name}</span>
        </div>
      </div>

      {!initialized ? (
        <div style={{ textAlign: 'center', padding: '20px' }}>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '16px' }}>
            Игра прошла? Нажмите кнопку ниже и отметьте, кто из игроков присутствовал — это спишет кредиты за сессию.
          </p>
          <button className="btn btn-primary btn-block" onClick={handleInit}>
            ✅ Игра состоялась
          </button>
        </div>
      ) : (
        <div className={styles.list}>
          {attendances.map((att) => (
            <div key={att.id} className={`card ${styles.attCard}`}>
              <div className={styles.attHeader}>
                <span className={styles.attName}>
                  {att.user_name || `Игрок #${att.user_id}`}
                </span>
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  <AttendanceBadge status={att.status} />
                  {att.status === 'attended' && !att.unpaid && (
                    <span className="badge badge-green">💳 Списан</span>
                  )}
                  {att.unpaid && (
                    <span className="badge badge-orange">⚠ Не оплачено</span>
                  )}
                </div>
              </div>

              <div className={styles.attActions}>
                {STATUS_OPTIONS.map((opt) => {
                  const isActive = att.status === opt.value;
                  const isDisabled = isActive || markingUserId !== null;
                  return (
                    <button
                      key={opt.value}
                      className={`btn btn-sm ${isActive ? 'btn-primary' : 'btn-secondary'}`}
                      onClick={() => handleMark(att.user_id, opt.value)}
                      disabled={isDisabled}
                    >
                      {markingUserId === att.user_id && !isActive ? '...' : `${opt.icon} ${opt.label}`}
                    </button>
                  );
                })}
              </div>

              {att.status === 'attended' && !att.unpaid && (
                <button
                  className="btn btn-danger btn-sm"
                  style={{ marginTop: '8px' }}
                  onClick={() => handleRefund(att.user_id)}
                  disabled={markingUserId !== null}
                >
                  ↩ Вернуть кредит
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}