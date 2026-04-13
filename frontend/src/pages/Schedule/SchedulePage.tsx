import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { calendarApi } from '../../api/calendar';
import type { CalendarEntry } from '../../types/index';
import { Loader } from '../../components/UI/Loader';
import { Empty } from '../../components/UI/Empty';
import { SignupBadge } from '../../components/UI/Badge';
import styles from './SchedulePage.module.css';

// ── Date helpers ──────────────────────────────────────────────────────────────

const MOSCOW_TZ = 'Europe/Moscow';

function getCurrentMondayISO(): string {
  const now = new Date();
  const moscowDateStr = now.toLocaleDateString('sv-SE', { timeZone: MOSCOW_TZ });
  const d = new Date(moscowDateStr + 'T00:00:00Z');
  const dow = d.getUTCDay(); // 0=Sun
  const diff = dow === 0 ? -6 : 1 - dow;
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().slice(0, 10);
}

function addDays(iso: string, n: number): string {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

const MONTH_NAMES = [
  'янв', 'фев', 'мар', 'апр', 'май', 'июн',
  'июл', 'авг', 'сен', 'окт', 'ноя', 'дек',
];

function formatWeekLabel(monday: string): string {
  const start = new Date(monday + 'T00:00:00Z');
  const end = new Date(monday + 'T00:00:00Z');
  end.setUTCDate(end.getUTCDate() + 6);
  const sm = MONTH_NAMES[start.getUTCMonth()];
  const em = MONTH_NAMES[end.getUTCMonth()];
  return sm === em
    ? `${start.getUTCDate()}–${end.getUTCDate()} ${sm}`
    : `${start.getUTCDate()} ${sm} – ${end.getUTCDate()} ${em}`;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('ru-RU', {
    timeZone: MOSCOW_TZ,
    hour: '2-digit',
    minute: '2-digit',
  });
}

function groupByDay(entries: CalendarEntry[]): Map<string, CalendarEntry[]> {
  const map = new Map<string, CalendarEntry[]>();
  for (const e of entries) {
    const key = new Date(e.starts_at).toLocaleDateString('sv-SE', { timeZone: MOSCOW_TZ });
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(e);
  }
  return map;
}

const DAY_NAMES = [
  'Воскресенье', 'Понедельник', 'Вторник', 'Среда',
  'Четверг', 'Пятница', 'Суббота',
];

function formatDayHeader(iso: string): string {
  const d = new Date(iso + 'T00:00:00Z');
  return `${DAY_NAMES[d.getUTCDay()]}, ${d.getUTCDate()} ${MONTH_NAMES[d.getUTCMonth()]}`;
}

function getCardClass(entry: CalendarEntry): string {
  if (entry.is_gm || entry.signup_status === 'confirmed') return styles.cardMine;
  if (entry.signup_status) return styles.cardPending;
  return '';
}

// ── Component ─────────────────────────────────────────────────────────────────

export function SchedulePage() {
  const navigate = useNavigate();
  const [weekStart, setWeekStart] = useState<string>(getCurrentMondayISO);
  const [sessions, setSessions] = useState<CalendarEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    calendarApi.weekly(weekStart)
      .then(setSessions)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [weekStart]);

  function goToPrevWeek() {
    setLoading(true);
    setWeekStart((w) => addDays(w, -7));
  }

  function goToNextWeek() {
    setLoading(true);
    setWeekStart((w) => addDays(w, 7));
  }

  const grouped = groupByDay(sessions);

  return (
    <div className={`animate-fade-in ${styles.page}`}>
      <h1>Расписание</h1>

      <div className={styles.weekNav}>
        <button className={styles.navArrow} onClick={goToPrevWeek}>
          ←
        </button>
        <span className={styles.weekLabel}>{formatWeekLabel(weekStart)}</span>
        <button className={styles.navArrow} onClick={goToNextWeek}>
          →
        </button>
      </div>

      {loading ? (
        <Loader />
      ) : sessions.length === 0 ? (
        <Empty icon="📅" title="Нет сессий на этой неделе" />
      ) : (
        <div className={styles.dayList}>
          {Array.from(grouped.entries()).map(([dayKey, daySessions]) => (
            <div key={dayKey} className={styles.dayBlock}>
              <div className={styles.dayHeader}>{formatDayHeader(dayKey)}</div>
              <div className={styles.sessionList}>
                {daySessions.map((entry) => (
                  <div
                    key={entry.session_id}
                    className={`card ${styles.sessionCard} ${getCardClass(entry)}`}
                    onClick={() => navigate(entry.is_gm ? `/gm/sessions/${entry.session_id}` : `/sessions/${entry.session_id}`)}
                  >
                    <div className={styles.cardRow}>
                      <span className={styles.timeRange}>
                        {formatTime(entry.starts_at)}–{formatTime(entry.ends_at)}
                      </span>
                      <span className="badge badge-blue">{entry.room_name}</span>
                    </div>
                    <div className={styles.title}>{entry.campaign_title}</div>
                    <div className={styles.footer}>
                      <span className={styles.capacity}>
                        {entry.confirmed_count}/{entry.capacity}
                      </span>
                      {entry.signup_status && (
                        <SignupBadge status={entry.signup_status} />
                      )}
                      {entry.is_gm && (
                        <span className="badge badge-purple">ГМ</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
