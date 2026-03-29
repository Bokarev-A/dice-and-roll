import { useEffect, useState } from 'react';
import { attendanceApi } from '../../api/attendance';
import type { UnpaidEntry } from '../../types/index';
import { Loader } from '../../components/UI/Loader';
import { Empty } from '../../components/UI/Empty';
import { formatDate } from '../../utils/format';
import styles from './Admin.module.css';

export function UnpaidPage() {
  const [entries, setEntries] = useState<UnpaidEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const data = await attendanceApi.listUnpaid();
        setEntries(data);
      } catch {
        // silent
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) return <Loader />;

  return (
    <div className={`animate-fade-in ${styles.page}`}>
      <h1>Неоплаченные</h1>

      {entries.length === 0 ? (
        <Empty icon="✅" title="Все посещения оплачены" />
      ) : (
        <div className={styles.list}>
          {entries.map((entry) => (
            <div key={entry.attendance_id} className={`card ${styles.unpaidCard}`}>
              <div className={styles.unpaidHeader}>
                <span className={styles.unpaidName}>{entry.user_name}</span>
                <span className="badge badge-orange">Не оплачено</span>
              </div>
              <div className={styles.unpaidMeta}>
                🎲 {entry.campaign_title}
              </div>
              <div className={styles.unpaidMeta}>
                📅 {formatDate(entry.session_date)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}