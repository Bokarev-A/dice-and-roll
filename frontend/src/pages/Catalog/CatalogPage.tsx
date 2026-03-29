import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { calendarApi } from '../../api/calendar';
import { campaignsApi } from '../../api/campaigns';
import type { PublicSessionEntry, Campaign } from '../../types/index';
import { Loader } from '../../components/UI/Loader';
import { Empty } from '../../components/UI/Empty';
import { CampaignCard } from '../../components/Campaign/CampaignCard';
import { formatDate, formatTime } from '../../utils/format';
import styles from './CatalogPage.module.css';

type Tab = 'oneshots' | 'campaigns';

export function CatalogPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('oneshots');
  const [sessions, setSessions] = useState<PublicSessionEntry[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        if (tab === 'oneshots') {
          const data = await calendarApi.public();
          setSessions(data);
        } else {
          const data = await campaignsApi.list();
          setCampaigns(data.filter((c) => c.type === 'campaign'));
        }
      } catch {
        // silent
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [tab]);

  return (
    <div className={`animate-fade-in ${styles.page}`}>
      <h1>Каталог</h1>

      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${tab === 'oneshots' ? styles.tabActive : ''}`}
          onClick={() => setTab('oneshots')}
        >
          Ваншоты
        </button>
        <button
          className={`${styles.tab} ${tab === 'campaigns' ? styles.tabActive : ''}`}
          onClick={() => setTab('campaigns')}
        >
          Кампании
        </button>
      </div>

      {loading ? (
        <Loader />
      ) : tab === 'oneshots' ? (
        sessions.length === 0 ? (
          <Empty icon="🎲" title="Нет доступных ваншотов" subtitle="Загляните позже!" />
        ) : (
          <div className={styles.list}>
            {sessions.map((s) => (
              <div
                key={s.session_id}
                className={`card ${styles.oneshotCard}`}
                onClick={() => navigate(`/campaign/${s.campaign_id}`)}
              >
                <div className={styles.oneshotHeader}>
                  <div>
                    <span className={styles.oneshotDate}>
                      {formatDate(s.starts_at)}
                    </span>
                    <span className={styles.oneshotTime}>
                      {formatTime(s.starts_at)} — {formatTime(s.ends_at)}
                    </span>
                  </div>
                  <span className={styles.spots}>
                    {s.spots_left} мест
                  </span>
                </div>

                <h3 className={styles.oneshotTitle}>{s.campaign_title}</h3>

                {s.system && (
                  <div className={styles.system}>{s.system}</div>
                )}

                <div className={styles.oneshotMeta}>
                  🚪 {s.room_name} · 👥 {s.confirmed_count}/{s.capacity}
                </div>
              </div>
            ))}
          </div>
        )
      ) : campaigns.length === 0 ? (
        <Empty icon="📜" title="Нет активных кампаний" />
      ) : (
        <div className={styles.list}>
          {campaigns.map((c) => (
            <CampaignCard
              key={c.id}
              campaign={c}
              onClick={() => navigate(`/campaign/${c.id}`)}
            />
          ))}
        </div>
      )}
    </div>
  );
}