import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { campaignsApi } from '../../api/campaigns';
import { sessionsApi } from '../../api/sessions';
import { signupsApi } from '../../api/signups';
import { roomsApi } from '../../api/rooms';
import type { Campaign, GameSession, CampaignMember, Room } from '../../types/index';
import { useAuthStore } from '../../store/useAuthStore';
import { useUIStore } from '../../store/useUIStore';
import { SessionCard } from '../../components/Session/SessionCard';
import { Badge } from '../../components/UI/Badge';
import { Loader } from '../../components/UI/Loader';
import { Empty } from '../../components/UI/Empty';
import { BackButton } from '../../components/UI/BackButton';
import { localInputToISO, resolveEndDate } from '../../utils/format';
import styles from './CampaignPage.module.css';

export function CampaignPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const showToast = useUIStore((s) => s.showToast);

  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [sessions, setSessions] = useState<GameSession[]>([]);
  const [members, setMembers] = useState<CampaignMember[]>([]);
  const [mySignups, setMySignups] = useState<number[]>([]); // session_id[]
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);

  // Edit campaign form (GM owner only)
  const [showEdit, setShowEdit] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editSystem, setEditSystem] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editCapacity, setEditCapacity] = useState(5);
  const [saving, setSaving] = useState(false);

  // Create session form (GM owner only)
  const [showCreateSession, setShowCreateSession] = useState(false);
  const [roomId, setRoomId] = useState<number>(0);
  const [startsAt, setStartsAt] = useState('');
  const [endsAtTime, setEndsAtTime] = useState('');
  const [sessionDescription, setSessionDescription] = useState('');
  const [creating, setCreating] = useState(false);

  const campaignId = Number(id);
  const isMember = members.some((m) => m.user_id === user?.id && m.status === 'active');
  const hasPendingApp = members.some((m) => m.user_id === user?.id && m.status === 'pending');
  const isOwnerGM = campaign?.owner_gm_user_id === user?.id;
  const isGMOrAdmin = user?.role === 'gm' || user?.role === 'private_gm' || user?.role === 'admin';

  async function load() {
    try {
      const promises: Promise<any>[] = [
        campaignsApi.getById(campaignId),
        sessionsApi.getByCampaign(campaignId),
        campaignsApi.listMembers(campaignId),
        signupsApi.my(),
      ];
      if (isGMOrAdmin) {
        promises.push(roomsApi.list());
      }

      const results = await Promise.all(promises);
      const [c, s, m, signups, roomList] = results;

      setCampaign(c);
      setSessions(s);
      setMembers(m);
      setMySignups(
        signups
          .filter((sg: any) => sg.status !== 'cancelled')
          .map((sg: any) => sg.session_id)
      );
      if (roomList) {
        setRooms(roomList);
        if (roomList.length > 0 && roomId === 0) {
          setRoomId(roomList[0].id);
        }
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [campaignId]);

  async function handleJoin() {
    setActionLoading(true);
    try {
      await campaignsApi.join(campaignId);
      showToast('Вы присоединились!', 'success');
      await load();
    } catch (err: any) {
      showToast(err.response?.data?.detail || 'Ошибка', 'error');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleLeave() {
    setActionLoading(true);
    try {
      await campaignsApi.leave(campaignId);
      showToast('Вы покинули кампанию', 'info');
      await load();
    } catch (err: any) {
      showToast(err.response?.data?.detail || 'Ошибка', 'error');
    } finally {
      setActionLoading(false);
    }
  }

  function openEdit() {
    if (!campaign) return;
    setEditTitle(campaign.title);
    setEditSystem(campaign.system ?? '');
    setEditDescription(campaign.description ?? '');
    setEditCapacity(campaign.capacity);
    setShowEdit(true);
  }

  async function handleSaveEdit() {
    if (!editTitle.trim()) return;
    setSaving(true);
    try {
      await campaignsApi.update(campaignId, {
        title: editTitle.trim(),
        system: editSystem.trim() || null,
        description: editDescription.trim() || null,
        capacity: editCapacity,
      });
      showToast('Сохранено', 'success');
      setShowEdit(false);
      await load();
    } catch (err: any) {
      showToast(err.response?.data?.detail || 'Ошибка при сохранении', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleApprove(memberId: number) {
    try {
      await campaignsApi.approveMember(campaignId, memberId);
      showToast('Заявка одобрена', 'success');
      await load();
    } catch (err: any) {
      showToast(err.response?.data?.detail || 'Ошибка', 'error');
    }
  }

  async function handleReject(memberId: number) {
    try {
      await campaignsApi.rejectMember(campaignId, memberId);
      showToast('Заявка отклонена', 'info');
      await load();
    } catch (err: any) {
      showToast(err.response?.data?.detail || 'Ошибка', 'error');
    }
  }

  async function handleSignup(sessionId: number) {
    try {
      await signupsApi.create(sessionId);
      showToast('Вы записаны!', 'success');
      await load();
    } catch (err: any) {
      showToast(err.response?.data?.detail || 'Ошибка', 'error');
    }
  }

  function handleStartsAtChange(value: string) {
    setStartsAt(value);
    if (value) {
      const timePart = value.split('T')[1] ?? '00:00';
      const [h, m] = timePart.split(':').map(Number);
      const totalMin = h * 60 + m + 240;
      const endH = Math.floor(totalMin / 60) % 24;
      const endM = totalMin % 60;
      setEndsAtTime(
        `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`
      );
    }
  }

  async function handleCreateSession() {
    if (!startsAt || !endsAtTime || !roomId) return;
    setCreating(true);
    try {
      await sessionsApi.create({
        campaign_id: campaignId,
        room_id: roomId,
        starts_at: localInputToISO(startsAt),
        ends_at: localInputToISO(`${resolveEndDate(startsAt, endsAtTime)}T${endsAtTime}`),
        description: sessionDescription.trim() || undefined,
      });
      showToast('Сессия создана!', 'success');
      setShowCreateSession(false);
      setStartsAt('');
      setEndsAtTime('');
      setSessionDescription('');
      await load();
    } catch (err: any) {
      showToast(err.response?.data?.detail || 'Ошибка', 'error');
    } finally {
      setCreating(false);
    }
  }

  if (loading) return <Loader />;
  if (!campaign) return <Empty icon="❌" title="Кампания не найдена" />;

  const isGMAdmin = isOwnerGM || user?.role === 'admin';

  const upcomingSessions = sessions.filter(
    (s) => s.status !== 'canceled' && s.status !== 'done' && new Date(s.ends_at) > new Date()
  );

  const pastSessions = sessions.filter(
    (s) => s.status === 'done' || s.status === 'canceled' || new Date(s.ends_at) <= new Date()
  ).sort((a, b) => new Date(b.starts_at).getTime() - new Date(a.starts_at).getTime());

  return (
    <div className={`animate-fade-in ${styles.page}`}>
      <BackButton to="/catalog" />
      <div className={styles.header}>
        <div className={styles.headerTop}>
          <Badge
            text={campaign.type === 'campaign' ? 'Кампания' : 'Ваншот'}
            color={campaign.type === 'campaign' ? 'purple' : 'blue'}
          />
          {isOwnerGM && (
            <button
              className="btn btn-secondary btn-sm"
              onClick={showEdit ? () => setShowEdit(false) : openEdit}
            >
              {showEdit ? '✕ Закрыть' : '✎ Изменить'}
            </button>
          )}
        </div>
        <h1 className={styles.title}>{campaign.title}</h1>
        {campaign.system && (
          <div className={styles.system}>{campaign.system}</div>
        )}
      </div>

      {/* Edit form — GM owner only */}
      {isOwnerGM && showEdit && (
        <div className={`card ${styles.createForm}`}>
          <div className={styles.formField}>
            <label className={styles.formLabel}>Название *</label>
            <input
              className="input"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
            />
          </div>
          <div className={styles.formField}>
            <label className={styles.formLabel}>Система</label>
            <input
              className="input"
              value={editSystem}
              onChange={(e) => setEditSystem(e.target.value)}
              placeholder="D&D 5e, Pathfinder..."
            />
          </div>
          <div className={styles.formField}>
            <label className={styles.formLabel}>Описание</label>
            <textarea
              className="input"
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              placeholder="Расскажите об игре..."
              rows={3}
            />
          </div>
          <div className={styles.formField}>
            <label className={styles.formLabel}>Количество мест</label>
            <input
              className="input"
              type="number"
              min="1"
              max="20"
              value={editCapacity}
              onChange={(e) => setEditCapacity(Number(e.target.value))}
            />
          </div>
          <button
            className="btn btn-primary btn-block"
            onClick={handleSaveEdit}
            disabled={saving || !editTitle.trim()}
          >
            Сохранить
          </button>
        </div>
      )}

      {campaign.description && !showEdit && (
        <div className={`card ${styles.descCard}`}>
          <p className={styles.description}>{campaign.description}</p>
        </div>
      )}

      <div className={styles.stats}>
        <div className={styles.stat}>
          <span className={styles.statValue}>{members.length}</span>
          <span className={styles.statLabel}>участников</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statValue}>{upcomingSessions.length}</span>
          <span className={styles.statLabel}>сессий</span>
        </div>
      </div>

      {/* Join (non-owner, not yet a member) */}
      {!isOwnerGM && !isMember && !hasPendingApp && (
        <button
          className="btn btn-primary btn-block"
          onClick={handleJoin}
          disabled={actionLoading}
        >
          Подать заявку
        </button>
      )}

      {/* Pending status indicator */}
      {!isOwnerGM && hasPendingApp && (
        <button className="btn btn-secondary btn-block" disabled>
          ⏳ На рассмотрении
        </button>
      )}

      <hr className="divider" />

      {/* Pending applications — GM owner only */}
      {isOwnerGM && (() => {
        const pending = members.filter((m) => m.status === 'pending');
        if (pending.length === 0) return null;
        return (
          <>
            <h2>Заявки ({pending.length})</h2>
            <div className={styles.memberList}>
              {pending.map((m) => {
                const displayName = [m.first_name, m.last_name].filter(Boolean).join(' ') || `Игрок #${m.user_id}`;
                return (
                  <div key={m.id} className={styles.memberItem}>
                    <div>
                      <span className={styles.memberName}>{displayName}</span>
                      {m.username && (
                        <span className={styles.memberUsername} style={{ marginLeft: '8px' }}>@{m.username}</span>
                      )}
                    </div>
                    <div className={styles.applicationActions}>
                      <button className="btn btn-success btn-sm" onClick={() => handleApprove(m.id)}>
                        ✓
                      </button>
                      <button className="btn btn-danger btn-sm" onClick={() => handleReject(m.id)}>
                        ✕
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
            <hr className="divider" />
          </>
        );
      })()}

      {/* Members */}
      {(() => {
        const active = members.filter((m) => m.status === 'active');
        return (
          <>
            <h2>Участники</h2>
            {active.length === 0 ? (
              <Empty icon="👥" title="Нет участников" />
            ) : (
              <div className={styles.memberList}>
                {active.map((m) => {
                  const displayName = [m.first_name, m.last_name].filter(Boolean).join(' ');
                  return (
                    <div key={m.id} className={styles.memberItem}>
                      <span className={styles.memberName}>{displayName}</span>
                      {m.username && (
                        <span className={styles.memberUsername}>@{m.username}</span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        );
      })()}

      <hr className="divider" />

      {/* Sessions */}
      <div className={styles.sessionsHeader}>
        <h2>Сессии</h2>
        {isOwnerGM && (
          <button
            className="btn btn-primary btn-sm"
            onClick={() => setShowCreateSession(!showCreateSession)}
          >
            {showCreateSession ? '✕' : '+ Новая'}
          </button>
        )}
      </div>

      {/* Create session form (GM owner only) */}
      {isOwnerGM && showCreateSession && (
        <div className={`card ${styles.createForm}`}>
          <h3>Новая сессия</h3>

          <div className={styles.formField}>
            <label className={styles.formLabel}>Комната</label>
            <select
              className="input"
              value={roomId}
              onChange={(e) => setRoomId(Number(e.target.value))}
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
              value={sessionDescription}
              onChange={(e) => setSessionDescription(e.target.value.slice(0, 500))}
              placeholder="Кратко о чём будет сессия..."
              rows={2}
              maxLength={500}
            />
            <div style={{
              textAlign: 'right',
              fontSize: '0.78rem',
              marginTop: '2px',
              color: sessionDescription.length >= 450 ? 'var(--color-danger, #ff4444)' : 'var(--text-muted)',
            }}>
              {sessionDescription.length}/500
            </div>
          </div>

          <div className={styles.formField}>
            <label className={styles.formLabel}>Начало</label>
            <input
              className="input"
              type="datetime-local"
              value={startsAt}
              onChange={(e) => handleStartsAtChange(e.target.value)}
            />
          </div>

          <div className={styles.formField}>
            <label className={styles.formLabel}>Конец (время)</label>
            <input
              className="input"
              type="time"
              value={endsAtTime}
              onChange={(e) => setEndsAtTime(e.target.value)}
            />
          </div>

          <button
            className="btn btn-primary btn-block"
            onClick={handleCreateSession}
            disabled={creating || !startsAt || !endsAtTime}
          >
            Создать сессию
          </button>
        </div>
      )}

      {upcomingSessions.length === 0 ? (
        <Empty icon="📅" title="Нет предстоящих сессий" />
      ) : (
        <div className={styles.sessionList}>
          {upcomingSessions.map((s) => (
            <div key={s.id}>
              <SessionCard
                session={s}
                showCampaign={false}
                onClick={() => navigate(isOwnerGM ? `/gm/sessions/${s.id}` : `/sessions/${s.id}`)}
              />
              {!isGMAdmin && isMember && (() => {
                const alreadySignedUp = mySignups.includes(s.id);
                if (alreadySignedUp) {
                  return (
                    <button
                      className="btn btn-primary btn-sm"
                      style={{ marginTop: '8px' }}
                      disabled
                    >
                      Уже записан
                    </button>
                  );
                }
                if (s.confirmed_count >= s.capacity) return null;
                return (
                  <button
                    className="btn btn-primary btn-sm"
                    style={{ marginTop: '8px' }}
                    onClick={() => handleSignup(s.id)}
                  >
                    Записаться
                  </button>
                );
              })()}
            </div>
          ))}
        </div>
      )}

      {/* Past sessions — visible to GM owner and admin */}
      {isGMAdmin && pastSessions.length > 0 && (
        <>
          <hr className="divider" />
          <h2>Прошедшие сессии ({pastSessions.length})</h2>
          <div className={styles.sessionList}>
            {pastSessions.map((s) => (
              <SessionCard
                key={s.id}
                session={s}
                showCampaign={false}
                onClick={() => navigate(`/gm/sessions/${s.id}`)}
              />
            ))}
          </div>
        </>
      )}
      {/* Leave / Withdraw — always at the very bottom */}
      {!isOwnerGM && (isMember || hasPendingApp) && (
        <>
          <hr className="divider" />
          {!showLeaveConfirm ? (
            <button
              className={`btn btn-block ${styles.leaveBtnMuted}`}
              onClick={() => setShowLeaveConfirm(true)}
              disabled={actionLoading}
            >
              {isMember ? 'Покинуть игру' : 'Отозвать заявку'}
            </button>
          ) : (
            <div className={styles.leaveConfirm}>
              <p className={styles.leaveConfirmText}>
                {isMember ? 'Точно хотите покинуть игру?' : 'Отозвать заявку на вступление?'}
              </p>
              <div className={styles.leaveConfirmButtons}>
                <button
                  className="btn btn-danger"
                  style={{ flex: 1 }}
                  onClick={handleLeave}
                  disabled={actionLoading}
                >
                  {isMember ? 'Да, покинуть' : 'Отозвать'}
                </button>
                <button
                  className="btn btn-secondary"
                  style={{ flex: 1 }}
                  onClick={() => setShowLeaveConfirm(false)}
                >
                  Отмена
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
