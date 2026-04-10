import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { campaignsApi } from '../../api/campaigns';
import { sessionsApi } from '../../api/sessions';
import { roomsApi } from '../../api/rooms';
import type { Campaign, GameSession, Room, CampaignMember } from '../../types/index';
import { useUIStore } from '../../store/useUIStore';
import { SessionCard } from '../../components/Session/SessionCard';
import { Badge } from '../../components/UI/Badge';
import { Loader } from '../../components/UI/Loader';
import { Empty } from '../../components/UI/Empty';
import { BackButton } from '../../components/UI/BackButton';
import styles from './GM.module.css';
import { localInputToISO } from '../../utils/format';

export function GMCampaignDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const showToast = useUIStore((s) => s.showToast);
  const campaignId = Number(id);

  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [sessions, setSessions] = useState<GameSession[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [members, setMembers] = useState<CampaignMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  // Session form
  const [roomId, setRoomId] = useState<number>(0);
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [capacity, setCapacity] = useState(5);
  const [creating, setCreating] = useState(false);

  async function load() {
    try {
      const [c, s, r, m] = await Promise.all([
        campaignsApi.getById(campaignId),
        sessionsApi.getByCampaign(campaignId),
        roomsApi.list(),
        campaignsApi.listMembers(campaignId),
      ]);
      setCampaign(c);
      setSessions(s);
      setRooms(r);
      setMembers(m);
      if (r.length > 0 && roomId === 0) {
        setRoomId(r[0].id);
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

  async function handleCreateSession() {
    if (!startsAt || !endsAt || !roomId) return;
    setCreating(true);
    try {
      await sessionsApi.create({
        campaign_id: campaignId,
        room_id: roomId,
        starts_at: localInputToISO(startsAt),
        ends_at: localInputToISO(endsAt),
        capacity,
      });
      showToast('Сессия создана!', 'success');
      setShowCreate(false);
      setStartsAt('');
      setEndsAt('');
      await load();
    } catch (err: any) {
      showToast(err.response?.data?.detail || 'Ошибка', 'error');
    } finally {
      setCreating(false);
    }
  }

  if (loading) return <Loader />;
  if (!campaign) return <Empty icon="❌" title="Кампания не найдена" />;

  return (
    <div className={`animate-fade-in ${styles.page}`}>
      <BackButton to="/gm/campaigns" />
      <div className={styles.pageHeader}>
        <div>
          <Badge
            text={campaign.type === 'campaign' ? 'Кампания' : 'Ваншот'}
            color={campaign.type === 'campaign' ? 'purple' : 'blue'}
          />
          <h1 style={{ marginTop: '8px' }}>{campaign.title}</h1>
        </div>
      </div>

      <button
        className="btn btn-primary btn-block"
        onClick={() => setShowCreate(!showCreate)}
      >
        {showCreate ? '✕ Отмена' : '+ Новая сессия'}
      </button>

      {/* Create session form */}
      {showCreate && (
        <div className={`card ${styles.createForm}`}>
          <h2>Новая сессия</h2>

          <div className={styles.field}>
            <label className={styles.label}>Комната</label>
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

          <div className={styles.field}>
            <label className={styles.label}>Начало</label>
            <input
              className="input"
              type="datetime-local"
              value={startsAt}
              onChange={(e) => setStartsAt(e.target.value)}
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Конец</label>
            <input
              className="input"
              type="datetime-local"
              value={endsAt}
              onChange={(e) => setEndsAt(e.target.value)}
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Мест</label>
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
            disabled={creating || !startsAt || !endsAt}
          >
            Создать сессию
          </button>
        </div>
      )}

      <hr className="divider" />

      {/* Pending applications */}
      {(() => {
        const pending = members.filter(m => m.status === 'pending');
        if (pending.length === 0) return null;
        return (
          <>
            <h2>Заявки ({pending.length})</h2>
            <div className={styles.list}>
              {pending.map((m) => {
                const name = [m.first_name, m.last_name].filter(Boolean).join(' ') || `Игрок #${m.user_id}`;
                return (
                  <div key={m.id} className={`card ${styles.signupCard}`}>
                    <div className={styles.signupHeader}>
                      <span className={styles.signupUser}>{name}</span>
                      {m.username && <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>@{m.username}</span>}
                    </div>
                    <div className={styles.signupActions}>
                      <button className="btn btn-success btn-sm" onClick={() => handleApprove(m.id)}>
                        ✓ Одобрить
                      </button>
                      <button className="btn btn-danger btn-sm" onClick={() => handleReject(m.id)}>
                        ✕ Отклонить
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

      {/* Active members */}
      {(() => {
        const active = members.filter(m => m.status === 'active');
        if (active.length === 0) return null;
        return (
          <>
            <h2>Участники ({active.length})</h2>
            <div className={styles.list}>
              {active.map((m) => {
                const name = [m.first_name, m.last_name].filter(Boolean).join(' ') || `Игрок #${m.user_id}`;
                return (
                  <div key={m.id} className={`card ${styles.signupCard}`}>
                    <div className={styles.signupHeader}>
                      <span className={styles.signupUser}>{name}</span>
                      {m.username && <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>@{m.username}</span>}
                    </div>
                    <div className={styles.signupActions}>
                      <button className="btn btn-danger btn-sm" onClick={() => handleReject(m.id)}>
                        Удалить
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

      {/* Sessions list */}
      <h2>Сессии ({sessions.length})</h2>
      {sessions.length === 0 ? (
        <Empty icon="📅" title="Нет сессий" subtitle="Создайте первую сессию" />
      ) : (
        <div className={styles.list}>
          {sessions.map((s) => (
            <SessionCard
              key={s.id}
              session={s}
              showCampaign={false}
              onClick={() => navigate(`/gm/sessions/${s.id}`)}
            />
          ))}
        </div>
      )}
    </div>
  );
}