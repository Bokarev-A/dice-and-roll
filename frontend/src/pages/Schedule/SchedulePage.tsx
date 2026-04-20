import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { calendarApi } from '../../api/calendar';
import { roomsApi } from '../../api/rooms';
import type { CalendarEntry, Room } from '../../types/index';
import { Loader } from '../../components/UI/Loader';
import { Empty } from '../../components/UI/Empty';
import { SignupBadge } from '../../components/UI/Badge';
import styles from './SchedulePage.module.css';

// ── Date helpers ──────────────────────────────────────────────────────────────

const MOSCOW_TZ = 'Europe/Moscow';

function getTodayISO(): string {
  return new Date().toLocaleDateString('sv-SE', { timeZone: MOSCOW_TZ });
}

function addDays(iso: string, n: number): string {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function getMondayISO(iso: string): string {
  const d = new Date(iso + 'T00:00:00Z');
  const dow = d.getUTCDay();
  const diff = dow === 0 ? -6 : 1 - dow;
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().slice(0, 10);
}

function isSameDay(isoDatetime: string, dateISO: string): boolean {
  const local = new Date(isoDatetime).toLocaleDateString('sv-SE', { timeZone: MOSCOW_TZ });
  return local === dateISO;
}

const SHORT_DAY_NAMES = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
const MONTH_NAMES = [
  'янв', 'фев', 'мар', 'апр', 'май', 'июн',
  'июл', 'авг', 'сен', 'окт', 'ноя', 'дек',
];

function formatStripDay(iso: string): { dayName: string; dayNum: number } {
  const d = new Date(iso + 'T00:00:00Z');
  return { dayName: SHORT_DAY_NAMES[d.getUTCDay()], dayNum: d.getUTCDate() };
}

function formatDayHeader(iso: string): string {
  const d = new Date(iso + 'T00:00:00Z');
  const fullDay = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];
  return `${fullDay[d.getUTCDay()]}, ${d.getUTCDate()} ${MONTH_NAMES[d.getUTCMonth()]}`;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('ru-RU', {
    timeZone: MOSCOW_TZ,
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getCardClass(entry: CalendarEntry): string {
  if (entry.is_gm || entry.signup_status === 'confirmed') return styles.cardMine;
  if (entry.signup_status) return styles.cardPending;
  return '';
}

// ── Component ─────────────────────────────────────────────────────────────────

export function SchedulePage() {
  const navigate = useNavigate();
  const [selectedDate, setSelectedDate] = useState<string>(getTodayISO);
  const [entries, setEntries] = useState<CalendarEntry[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);

  const today = getTodayISO();
  // stripStart — первый день в ленте; изначально сегодня минус 2
  const [stripStart, setStripStart] = useState<string>(() => addDays(getTodayISO(), -2));

  useEffect(() => {
    roomsApi.list().then((data: Room[]) => setRooms(data.filter((r) => r.is_active)));
  }, []);

  useEffect(() => {
    setLoading(true);
    calendarApi.weekly(getMondayISO(selectedDate))
      .then(setEntries)
      .catch(() => setEntries([]))
      .finally(() => setLoading(false));
  }, [selectedDate]);

  const stripDays = [0, 1, 2, 3, 4].map((n) => addDays(stripStart, n));
  const dayEntries = entries.filter((e) => isSameDay(e.starts_at, selectedDate));

  return (
    <div className={`animate-fade-in ${styles.page}`}>
      <h1>Расписание</h1>

      <div className={styles.stripRow}>
        <button className={styles.stripArrow} onClick={() => setStripStart((s) => addDays(s, -1))}>←</button>
        <div className={styles.dayStrip}>
          {stripDays.map((date) => {
            const { dayName, dayNum } = formatStripDay(date);
            const isSelected = date === selectedDate;
            const isToday = date === today;
            return (
              <button
                key={date}
                className={[
                  styles.dayPill,
                  isSelected ? styles.dayPillSelected : '',
                  isToday && !isSelected ? styles.dayPillToday : '',
                ].join(' ')}
                onClick={() => setSelectedDate(date)}
              >
                <span className={styles.pillDayName}>{dayName}</span>
                <span className={styles.pillDayNum}>{dayNum}</span>
              </button>
            );
          })}
        </div>
        <button className={styles.stripArrow} onClick={() => setStripStart((s) => addDays(s, 1))}>→</button>
      </div>

      <div className={styles.dayTitle}>{formatDayHeader(selectedDate)}</div>

      {loading ? (
        <Loader />
      ) : dayEntries.length === 0 ? (
        <Empty icon="📅" title="Нет сессий" />
      ) : (
        <div className={styles.roomList}>
          {rooms.map((room) => {
            const roomSessions = dayEntries.filter((e) => e.room_name === room.name);
            return (
              <div key={room.id} className={styles.roomSection}>
                <div className={styles.roomHeader}>{room.name}</div>
                {roomSessions.length === 0 ? (
                  <div className={styles.emptyRoom}>Нет сессий</div>
                ) : (
                  <div className={styles.sessionList}>
                    {roomSessions.map((entry) => (
                      <div
                        key={entry.session_id}
                        className={`card ${styles.sessionCard} ${getCardClass(entry)}`}
                        onClick={() =>
                          navigate(
                            entry.is_gm
                              ? `/gm/sessions/${entry.session_id}`
                              : `/sessions/${entry.session_id}`
                          )
                        }
                      >
                        <div className={styles.cardRow}>
                          <span className={styles.timeRange}>
                            {formatTime(entry.starts_at)}–{formatTime(entry.ends_at)}
                          </span>
                          <span className="badge badge-blue">{entry.room_name}</span>
                        </div>
                        <div className={styles.title}>{entry.campaign_title}</div>
                        {entry.system && (
                          <div className={styles.system}>{entry.system}</div>
                        )}
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
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
