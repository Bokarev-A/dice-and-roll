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

export function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleTimeString('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: TIMEZONE,
  });
}

export function formatDateTime(dateStr: string): string {
  return `${formatDate(dateStr)} ${formatTime(dateStr)}`;
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