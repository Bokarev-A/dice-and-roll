import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { sessionsApi } from '../../api/sessions';
import { signupsApi } from '../../api/signups';
import { roomsApi } from '../../api/rooms';
import { attendanceApi } from '../../api/attendance';
import type { GameSession, Signup, Room, Attendance } from '../../types/index';
import { useUIStore } from '../../store/useUIStore';
import { SessionBadge, SignupBadge, AttendanceBadge } from '../../components/UI/Badge';
import { Loader } from '../../components/UI/Loader';
import { Empty } from '../../components/UI/Empty';
import { BackButton } from '../../components/UI/BackButton';
import { formatDateTime, localInputToISO, resolveEndDate } from '../../utils/format';
import styles from './GM.module.css';
import sessionStyles from '../Session/Session.module.css';

export function GMSessionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const showToast = useUIStore((s) => s.showToast);
  const sessionId = Number(id);

  const [session, setSession] = useState<GameSession | null>(null);
  const [signups, setSignups] = useState<Signup[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [attendances, setAttendances] = useState<Attendance[]>([]);
  const [loading, setLoading] = useState(true);

  // Edit form state
  const [editMode, setEditMode] = useState(false);
  const [editRoomId, setEditRoomId] = useState(0);
  const [editStartsAt, setEditStartsAt] = useState('');
  const [editEndsAtTime, setEditEndsAtTime] = useState('');
  const [editCapacity, setEditCapacity] = useState(5);
  const [editDescription, setEditDescription] = useState('');
  const [saving, setSaving] = useState(false);

  async function load() {
    try {
      const [s, sg, rm, att] = await Promise.all([
        sessionsApi.getById(sessionId),
        signupsApi.listBySession(sessionId),
        roomsApi.list(),
        attendanceApi.listBySession(sessionId),
      ]);
      setSession(s);
      setSignups(sg);
      setRooms(rm);
      setAttendances(att);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [sessionId]);

  function openEdit() {
    if (!session) return;
    const dt = new Date(session.starts_at);
    const pad = (n: number) => String(n).padStart(2, '0');
    const localDate = `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
    const localTime = `${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
    const endDt = new Date(session.ends_at);
    const endTime = `${pad(endDt.getHours())}:${pad(endDt.getMinutes())}`;

    setEditRoomId(session.room_id);
    setEditStartsAt(`${localDate}T${localTime}`);
    setEditEndsAtTime(endTime);
    setEditCapacity(session.capacity);
    setEditDescription(session.description ?? '');
    setEditMode(true);
  }

  function handleStartsAtEditChange(value: string) {
    setEditStartsAt(value);
    if (value) {
      const [h, m] = (value.split('T')[1] ?? '00:00').split(':').map(Number);
      const total = h * 60 + m + 240;
      setEditEndsAtTime(
        `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
      );
    }
  }

  async function handleSaveEdit() {
    if (!editStartsAt || !editEndsAtTime || !editRoomId) return;
    setSaving(true);
    try {
      await sessionsApi.update(sessionId, {
        room_id: editRoomId,
        starts_at: localInputToISO(editStartsAt),
        ends_at: localInputToISO(`${resolveEndDate(editStartsAt, editEndsAtTime)}T${editEndsAtTime}`),
        capacity: editCapacity,
        description: editDescription.trim() || null,
      });
      showToast('Сессия обновлена', 'success');
      setEditMode(false);
      await load();
    } catch (err: any) {
      showToast(err.response?.data?.detail || 'Ошибка', 'error');
    } finally {
      setSaving(false);
    }
  }

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
  const attendanceMap = new Map(attendances.map((a) => [a.user_id, a]));
  const hasAttendance = attendances.length > 0;

  return (
    <div className={`animate-fade-in ${styles.page} ${sessionStyles.sessionPage}`}>
      <span className={sessionStyles.sessionTag}>Сессия</span>
      <BackButton />
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

      {/* Actions */}
      <div className={styles.actions}>
        <button
          className="btn btn-secondary btn-sm"
          onClick={() => navigate(`/gm/attendance/${session.id}`)}
        >
          ✅ Отметить посещаемость
        </button>
        {session.status !== 'canceled' && session.status !== 'done' && (
          <>
            <button className="btn btn-secondary btn-sm" onClick={openEdit}>
              ✏️ Редактировать
            </button>
            <button className="btn btn-danger btn-sm" onClick={handleCancel}>
              🚫 Отменить
            </button>
          </>
        )}
      </div>

      {/* Edit form */}
      {editMode && (
        <div className={`card ${styles.editForm}`}>
          <h3>Редактировать сессию</h3>

          <div className={styles.formField}>
            <label className={styles.formLabel}>Комната</label>
            <select
              className="input"
              value={editRoomId}
              onChange={(e) => setEditRoomId(Number(e.target.value))}
            >
              {rooms.map((r) => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          </div>

          <div className={styles.formField}>
            <label className={styles.formLabel}>Описание</label>
            <textarea
              className="input"
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value.slice(0, 500))}
              placeholder="Кратко о чём будет сессия..."
              rows={2}
              maxLength={500}
            />
            <div style={{
              textAlign: 'right',
              fontSize: '0.78rem',
              marginTop: '2px',
              color: editDescription.length >= 450 ? 'var(--color-danger, #ff4444)' : 'var(--text-muted)',
            }}>
              {editDescription.length}/500
            </div>
          </div>

          <div className={styles.formField}>
            <label className={styles.formLabel}>Начало</label>
            <input
              className="input"
              type="datetime-local"
              value={editStartsAt}
              onChange={(e) => handleStartsAtEditChange(e.target.value)}
            />
          </div>

          <div className={styles.formField}>
            <label className={styles.formLabel}>Конец (время)</label>
            <input
              className="input"
              type="time"
              value={editEndsAtTime}
              onChange={(e) => setEditEndsAtTime(e.target.value)}
            />
          </div>

          <div className={styles.formField}>
            <label className={styles.formLabel}>Мест</label>
            <input
              className="input"
              type="number"
              min="1"
              max="20"
              value={editCapacity}
              onChange={(e) => setEditCapacity(Number(e.target.value))}
            />
          </div>

          <div className={styles.actions}>
            <button
              className="btn btn-primary btn-sm"
              onClick={handleSaveEdit}
              disabled={saving || !editStartsAt || !editEndsAtTime}
            >
              {saving ? 'Сохранение...' : 'Сохранить'}
            </button>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => setEditMode(false)}
            >
              Отмена
            </button>
          </div>
        </div>
      )}

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
                  {signup.user_name || `Игрок #${signup.user_id}`}
                </span>
                {hasAttendance && attendanceMap.has(signup.user_id)
                  ? <AttendanceBadge status={attendanceMap.get(signup.user_id)!.status} />
                  : <SignupBadge status={signup.status} />
                }
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
