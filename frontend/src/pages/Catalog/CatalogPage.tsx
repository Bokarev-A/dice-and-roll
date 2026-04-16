import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { campaignsApi } from '../../api/campaigns';
import type { Campaign } from '../../types/index';
import { useAuthStore } from '../../store/useAuthStore';
import { useUIStore } from '../../store/useUIStore';
import { Loader } from '../../components/UI/Loader';
import { Empty } from '../../components/UI/Empty';
import { CampaignCard } from '../../components/Campaign/CampaignCard';
import styles from './CatalogPage.module.css';

type Tab = 'oneshots' | 'campaigns' | 'mine';

export function CatalogPage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const showToast = useUIStore((s) => s.showToast);
  const isGM = user?.role === 'gm' || user?.role === 'private_gm' || user?.role === 'admin';

  const [tab, setTab] = useState<Tab>('mine');
  const [oneshots, setOneshots] = useState<Campaign[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [mineCampaigns, setMineCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [joinedIds, setJoinedIds] = useState<Set<number>>(new Set());

  // Load joined campaign IDs once to determine player role across all tabs
  useEffect(() => {
    campaignsApi.joined().then((data) => {
      setJoinedIds(new Set(data.map((c) => c.id)));
    }).catch(() => {});
  }, []);

  function getRoleForCampaign(c: Campaign): 'gm' | 'player' | undefined {
    if (c.owner_gm_user_id === user?.id) return 'gm';
    if (joinedIds.has(c.id)) return 'player';
    return undefined;
  }

  // Create campaign form (GM only)
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState('');
  const [type, setType] = useState<'campaign' | 'oneshot'>('oneshot');
  const [system, setSystem] = useState('');
  const [description, setDescription] = useState('');
  const [capacity, setCapacity] = useState(5);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        if (tab === 'oneshots') {
          const data = await campaignsApi.list();
          setOneshots(data.filter((c) => c.type === 'oneshot'));
        } else if (tab === 'campaigns') {
          const data = await campaignsApi.list();
          setCampaigns(data.filter((c) => c.type === 'campaign'));
        } else {
          if (isGM) {
            const [owned, joined] = await Promise.all([
              campaignsApi.my(),
              campaignsApi.joined(),
            ]);
            const ownedIds = new Set(owned.map((c) => c.id));
            const merged = [
              ...owned,
              ...joined.filter((c) => !ownedIds.has(c.id)),
            ];
            setMineCampaigns(merged);
            setJoinedIds(new Set(joined.map((c) => c.id)));
          } else {
            const data = await campaignsApi.joined();
            setMineCampaigns(data);
          }
        }
      } catch {
        // silent
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [tab]);

  async function handleCreate() {
    if (!title.trim()) return;
    setCreating(true);
    try {
      const campaign = await campaignsApi.create({
        type,
        title: title.trim(),
        system: system.trim() || undefined,
        description: description.trim() || undefined,
        capacity,
      });
      navigate(`/campaign/${campaign.id}`);
    } catch (err: any) {
      showToast(err.response?.data?.detail || 'Ошибка при создании', 'error');
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className={`animate-fade-in ${styles.page}`}>
      <h1>Каталог</h1>

      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${tab === 'mine' ? styles.tabActive : ''}`}
          onClick={() => setTab('mine')}
        >
          Мои
        </button>
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
        oneshots.length === 0 ? (
          <Empty icon="🎲" title="Нет доступных ваншотов" subtitle="Загляните позже!" />
        ) : (
          <div className={styles.list}>
            {oneshots.map((c) => (
              <CampaignCard
                key={c.id}
                campaign={c}
                role={getRoleForCampaign(c)}
                onClick={() => navigate(`/campaign/${c.id}`)}
              />
            ))}
          </div>
        )
      ) : tab === 'campaigns' ? (
        campaigns.length === 0 ? (
          <Empty icon="📜" title="Нет активных кампаний" />
        ) : (
          <div className={styles.list}>
            {campaigns.map((c) => (
              <CampaignCard
                key={c.id}
                campaign={c}
                role={getRoleForCampaign(c)}
                onClick={() => navigate(`/campaign/${c.id}`)}
              />
            ))}
          </div>
        )
      ) : (
        // "Мои" tab
        <>
          {isGM && (
            <div className={styles.mineHeader}>
              <button
                className="btn btn-primary btn-block"
                onClick={() => setShowCreate(!showCreate)}
              >
                {showCreate ? '✕ Закрыть' : '+ Создать игру'}
              </button>
            </div>
          )}

          {showCreate && (
            <div className={`card ${styles.createForm}`}>
              <h2>Новая кампания</h2>

              <div className={styles.field}>
                <label className={styles.fieldLabel}>Тип</label>
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
                <label className={styles.fieldLabel}>Название *</label>
                <input
                  className="input"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Проклятие Страда..."
                />
              </div>

              <div className={styles.field}>
                <label className={styles.fieldLabel}>Система</label>
                <input
                  className="input"
                  value={system}
                  onChange={(e) => setSystem(e.target.value)}
                  placeholder="D&D 5e, Pathfinder..."
                />
              </div>

              <div className={styles.field}>
                <label className={styles.fieldLabel}>Описание</label>
                <textarea
                  className="input"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Расскажите об игре..."
                />
              </div>

              <div className={styles.field}>
                <label className={styles.fieldLabel}>Количество мест</label>
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
                onClick={handleCreate}
                disabled={creating || !title.trim()}
              >
                Создать
              </button>
            </div>
          )}

          {mineCampaigns.length === 0 ? (
            <Empty
              icon="🎲"
              title={isGM ? 'Нет кампаний' : 'Вы не состоите в кампаниях'}
              subtitle={isGM ? 'Создайте свою первую кампанию' : 'Найдите игру во вкладках выше'}
            />
          ) : (
            <div className={styles.list}>
              {mineCampaigns.map((c) => (
                <CampaignCard
                  key={c.id}
                  campaign={c}
                  role={getRoleForCampaign(c)}
                  onClick={() => navigate(`/campaign/${c.id}`)}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
