import type { Campaign } from '../../types/index';
import { Badge } from '../UI/Badge';
import styles from './CampaignCard.module.css';

interface CampaignCardProps {
  campaign: Campaign;
  onClick?: () => void;
}

export function CampaignCard({ campaign, onClick }: CampaignCardProps) {
  return (
    <div className={`card ${styles.campaign}`} onClick={onClick}>
      <div className={styles.header}>
        <Badge
          text={campaign.type === 'campaign' ? 'Кампания' : 'Ваншот'}
          color={campaign.type === 'campaign' ? 'purple' : 'blue'}
        />
        <span className={styles.members}>👥 {campaign.member_count}</span>
      </div>

      <h3 className={styles.title}>{campaign.title}</h3>

      {campaign.system && (
        <div className={styles.system}>{campaign.system}</div>
      )}

      {campaign.description && (
        <p className={styles.desc}>
          {campaign.description.length > 100
            ? campaign.description.slice(0, 100) + '...'
            : campaign.description}
        </p>
      )}
    </div>
  );
}