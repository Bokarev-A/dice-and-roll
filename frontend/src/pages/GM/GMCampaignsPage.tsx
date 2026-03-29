import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { campaignsApi } from '../../api/campaigns';
import type { Campaign } from '../../types/index';
import { useAuthStore } from '../../store/useAuthStore';
import { CampaignCard } from '../../components/Campaign/CampaignCard';
import { Loader } from '../../components/UI/Loader';
import { Empty } from '../../components/UI/Empty';
import styles from './GM.module.css';

export function GMCampaignsPage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  // Form state
  const [title, setTitle] = useState('');
  const [type, setType] = useState<'campaign' | 'oneshot'>('oneshot');
  const [system, setSystem] = useState('');
  const [description, setDescription] = useState('');
  const [creating, setCreating] = useState(false);

  async function load() {
    try {
      const all = await campaignsApi.list();
      // Filter to owned campaigns + all if admin
      const mine = all.filter(
        (c) => c.owner_gm_user_id === user?.id || user?.role === 'admin'
      );
      setCampaigns(mine);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleCreate() {
    if (!title.trim()) return;
    setCreating(true);
    try {
      const campaign = await campaignsApi.create({
        type,
        title: title.trim(),
        system: system.trim() || undefined,
        description: description.trim() || undefined,
      });
      navigate(`/gm/campaigns/${campaign.id}`);
    } catch {
      // silent
    } finally {
      setCreating(false);
    }
  }

  if (loading) return <Loader />;

  return (
    <div className={`animate-fade-in ${styles.page}`}>
      <div className={styles.pageHeader}>
        <h1>Мои кампании</h1>
        <button
          className="btn btn-primary btn-sm"
          onClick={() => setShowCreate(!showCreate)}
        >
          {showCreate ? '✕' : '+ Новая'}
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className={`card ${styles.createForm}`}>
          <h2>Новая кампания</h2>

          <div className={styles.field}>
            <label className={styles.label}>Тип</label>
            <div className={styles.typeButtons}>
              <button
                className={`btn btn-sm ${type === 'oneshot' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setType('oneshot')}
              >
                Ваншот
              </button>
              <button
                className={`btn btn-sm ${type === 'campaign' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setType('campaign')}
              >
                Кампания
              </button>
            </div>
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Название *</label>
            <input
              className="input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Проклятие Страда..."
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Система</label>
            <input
              className="input"
              value={system}
              onChange={(e) => setSystem(e.target.value)}
              placeholder="D&D 5e, Pathfinder..."
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Описание</label>
            <textarea
              className="input"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Расскажите об игре..."
            />
          </div>

          <button
            className="btn btn-primary btn-block"
            onClick={handleCreate}
            disabled={creating || !title.trim()}
          >
            Создать
          </button>
        </div>
      )}

      {/* Campaign list */}
      {campaigns.length === 0 ? (
        <Empty
          icon="🎲"
          title="Нет кампаний"
          subtitle="Создайте свою первую кампанию"
        />
      ) : (
        <div className={styles.list}>
          {campaigns.map((c) => (
            <CampaignCard
              key={c.id}
              campaign={c}
              onClick={() => navigate(`/gm/campaigns/${c.id}`)}
            />
          ))}
        </div>
      )}
    </div>
  );
}