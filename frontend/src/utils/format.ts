const TIMEZONE = 'Europe/Moscow';

export function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: TIMEZONE,
  });
}

export function formatDateWithDay(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('ru-RU', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    timeZone: TIMEZONE,
  });
}

export function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleTimeString('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: TIMEZONE,
  });
}

export function formatDateTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: TIMEZONE,
  });
}

export function formatPrice(price: number): string {
  return `${price.toLocaleString('ru-RU')} ₽`;
}

export function formatCredits(count: number): string {
  const forms = ['кредит', 'кредита', 'кредитов'];
  const n = Math.abs(count) % 100;
  const n1 = n % 10;
  if (n > 10 && n < 20) return `${count} ${forms[2]}`;
  if (n1 > 1 && n1 < 5) return `${count} ${forms[1]}`;
  if (n1 === 1) return `${count} ${forms[0]}`;
  return `${count} ${forms[2]}`;
}

export function pluralGames(count: number): string {
  const forms = ['игра', 'игры', 'игр'];
  const n = Math.abs(count) % 100;
  const n1 = n % 10;
  if (n > 10 && n < 20) return `${count} ${forms[2]}`;
  if (n1 > 1 && n1 < 5) return `${count} ${forms[1]}`;
  if (n1 === 1) return `${count} ${forms[0]}`;
  return `${count} ${forms[2]}`;
}

/**
 * Convert datetime-local input value to ISO string with Moscow offset.
 * "2026-03-28T15:00" → "2026-03-28T15:00:00+03:00"
 */
export function localInputToISO(value: string): string {
  return value + ':00+03:00';
}

/**
 * Given a start datetime-local string and an end time string (HH:MM),
 * returns the correct date part for ends_at — bumps to next day if end
 * time is earlier than start time (session goes past midnight).
 * "2026-03-28T22:00", "02:00" → "2026-03-29"
 * "2026-03-28T18:00", "22:00" → "2026-03-28"
 */
export function resolveEndDate(startsAtInput: string, endsAtTime: string): string {
  const datePart = startsAtInput.split('T')[0];
  const startTime = startsAtInput.split('T')[1]?.slice(0, 5) ?? '00:00';
  if (endsAtTime < startTime) {
    const [year, month, day] = datePart.split('-').map(Number);
    // Use local Date constructor to avoid UTC offset shifting the date
    const next = new Date(year, month - 1, day + 1);
    const y = next.getFullYear();
    const m = String(next.getMonth() + 1).padStart(2, '0');
    const d = String(next.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return datePart;
}