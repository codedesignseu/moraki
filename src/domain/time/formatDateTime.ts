import { formatClock } from './formatClock';

/**
 * A local date and time for display, e.g. "Fri 23 Oct, 14:05". `locale` picks
 * the words and order (see dateLocale in src/i18n); the clock is 24-hour.
 */
export function formatDateTime(epochMs: number, tz: string, locale: string): string {
  const day = new Intl.DateTimeFormat(locale, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: tz,
  }).format(epochMs);
  return `${day}, ${formatClock(epochMs, tz)}`;
}
