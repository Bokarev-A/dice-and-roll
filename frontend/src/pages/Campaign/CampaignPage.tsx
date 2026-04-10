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

  // Create session form (GM owner only)
  const [showCreateSession, setShowCreateSession] = useState(false);
  const [roomId, setRoomId] = useState<number>(0);
  const [startsAt, setStartsAt] = useState('');
  const [endsAtTime, setEndsAtTime] = useState('');
  const [capacity, setCapacity] = useState(5);
  const [sessionDescription, setSessionDescription] = useState('');
  const [creating, setCreating] = useState(false);

  const campaignId = Number(id);
  const isMember = members.some((m) => m.user_id === user?.id && m.status === 'active');
  const hasPendingApp = members.some((m) => m.user_id === user?.id && m.status === 'pending');
  const isOwnerGM = campaign?.owner_gm_user_id === user?.id;
  const isGMOrAdmin = user?.role === 'gm' || user?.role === 'admin';

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
        capacity,
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

  const futureSessions = sessions.filter(
    (s) => new Date(s.starts_at) > new Date() && s.status !== 'canceled'
  );

  return (
    <div className={`animate-fade-in ${styles.page}`}>
      <BackButton to="/catalog" />
      <div className={styles.header}>
        <Badge
          text={campaign.type === 'campaign' ? 'Кампания' : 'Ваншот'}
          color={campaign.type === 'campaign' ? 'purple' : 'blue'}
        />
        <h1 className={styles.title}>{campaign.title}</h1>
        {campaign.system && (
          <div className={styles.system}>{campaign.system}</div>
        )}
      </div>

      {campaign.description && (
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
          <span className={styles.statValue}>{futureSessions.length}</span>
          <span className={styles.statLabel}>сессий</span>
        </div>
      </div>

      {/* Join / Leave (non-owner players) */}
      {!isOwnerGM && (
        isMember ? (
          <button
            className="btn btn-danger btn-block"
            onClick={handleLeave}
            disabled={actionLoading}
          >
            Покинуть кампанию
          </button>
        ) : hasPendingApp ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <button className="btn btn-secondary btn-block" disabled>
              ⏳ На рассмотрении
            </button>
            <button
              className="btn btn-danger btn-block"
              onClick={handleLeave}
              disabled={actionLoading}
            >
              Отозвать заявку
            </button>
          </div>
        ) : (
          <button
            className="btn btn-primary btn-block"
            onClick={handleJoin}
            disabled={actionLoading}
          >
            Подать заявку
          </button>
        )
      )}

      <hr className="divider" />

      {/* Members */}
      <h2>Участники</h2>
      {members.length === 0 ? (
        <Empty icon="👥" title="Нет участников" />
      ) : (
        <div className={styles.memberList}>
          {members.filter((m) => m.status === 'active').map((m) => {
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
              onChange={(e) => setSessionDescription(e.target.value)}
              placeholder="Кратко о чём будет сессия..."
              rows={2}
              maxLength={200}
            />
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

          <div className={styles.formField}>
            <label className={styles.formLabel}>Мест</label>
            <input
              className="input"
              type="number"
              min="1"
              max="20"
              value={capacity}
              onChange={(e) => setCapacity(Number(e.target.value))}
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

      {futureSessions.length === 0 ? (
        <Empty icon="📅" title="Нет предстоящих сессий" />
      ) : (
        <div className={styles.sessionList}>
          {futureSessions.map((s) => (
            <div key={s.id}>
              <SessionCard
                session={s}
                showCampaign={false}
                onClick={() => navigate(isOwnerGM ? `/gm/sessions/${s.id}` : `/sessions/${s.id}`)}
              />
              {!isOwnerGM && isMember && (() => {
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
    </div>
  );
}
