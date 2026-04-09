import type { GameSession } from '../../types/index';
import { SessionBadge } from '../UI/Badge';
import { formatDate, formatTime } from '../../utils/format';
import styles from './SessionCard.module.css';

interface SessionCardProps {
  session: GameSession;
  onClick?: () => void;
  showCampaign?: boolean;
}

export function SessionCard({ session, onClick, showCampaign = true }: SessionCardProps) {
  const spotsLeft = Math.max(0, session.capacity - session.confirmed_count);

  return (
    <div className={`card ${styles.session}`} onClick={onClick}>
      <div className={styles.header}>
        <div className={styles.date}>
          <span className={styles.day}>{formatDate(session.starts_at)}</span>
          <span className={styles.time}>
            {formatTime(session.starts_at)} — {formatTime(session.ends_at)}
          </span>
        </div>
        <SessionBadge status={session.status} />
      </div>

      {showCampaign && (
        <h3 className={styles.title}>{session.campaign_title}</h3>
      )}

      {session.description && (
        <p className={styles.description}>{session.description}</p>
      )}

      <div className={styles.meta}>
        <span className={styles.room}>🚪 {session.room_name}</span>
        <span className={styles.spots}>
          👥 {session.confirmed_count}/{session.capacity}
          {spotsLeft > 0 && (
            <span className={styles.spotsLeft}> ({spotsLeft} свободно)</span>
          )}
        </span>
      </div>

      {session.waitlist_count > 0 && (
        <div className={styles.waitlist}>
          ⏳ В листе ожидания: {session.waitlist_count}
        </div>
      )}
    </div>
  );
}