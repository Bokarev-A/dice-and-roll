import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { campaignsApi } from '../../api/campaigns';
import { sessionsApi } from '../../api/sessions';
import { signupsApi } from '../../api/signups';
import type { Campaign, GameSession, CampaignMember } from '../../types/index';
import { useAuthStore } from '../../store/useAuthStore';
import { useUIStore } from '../../store/useUIStore';
import { SessionCard } from '../../components/Session/SessionCard';
import { Badge } from '../../components/UI/Badge';
import { Loader } from '../../components/UI/Loader';
import { Empty } from '../../components/UI/Empty';
import styles from './CampaignPage.module.css';

export function CampaignPage() {
  const { id } = useParams<{ id: string }>();
  //const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const showToast = useUIStore((s) => s.showToast);

  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [sessions, setSessions] = useState<GameSession[]>([]);
  const [members, setMembers] = useState<CampaignMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const campaignId = Number(id);
  const isMember = members.some((m) => m.user_id === user?.id);

  async function load() {
    try {
      const [c, s, m] = await Promise.all([
        campaignsApi.getById(campaignId),
        sessionsApi.getByCampaign(campaignId),
        campaignsApi.listMembers(campaignId),
      ]);
      setCampaign(c);
      setSessions(s);
      setMembers(m);
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

  if (loading) return <Loader />;
  if (!campaign) return <Empty icon="❌" title="Кампания не найдена" />;

  const futureSessions = sessions.filter(
    (s) => new Date(s.starts_at) > new Date() && s.status !== 'canceled'
  );

  return (
    <div className={`animate-fade-in ${styles.page}`}>
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

      {/* Join / Leave */}
      {!isMember ? (
        <button
          className="btn btn-primary btn-block"
          onClick={handleJoin}
          disabled={actionLoading}
        >
          Присоединиться
        </button>
      ) : (
        <button
          className="btn btn-danger btn-block"
          onClick={handleLeave}
          disabled={actionLoading}
        >
          Покинуть кампанию
        </button>
      )}

      <hr className="divider" />

      {/* Sessions */}
      <h2>Сессии</h2>
      {futureSessions.length === 0 ? (
        <Empty icon="📅" title="Нет предстоящих сессий" />
      ) : (
        <div className={styles.sessionList}>
          {futureSessions.map((s) => (
            <div key={s.id}>
              <SessionCard session={s} showCampaign={false} />
              {isMember && s.confirmed_count < s.capacity && (
                <button
                  className="btn btn-primary btn-sm"
                  style={{ marginTop: '8px' }}
                  onClick={() => handleSignup(s.id)}
                >
                  Записаться
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}