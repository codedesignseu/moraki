import { formatClock } from './formatClock';
import { formatDateTime } from './formatDateTime';
import { dayBucket } from './zoned';

const MINUTE_MS = 60_000;

/**
 * What a sheet's time field says (direction G: "Today, 22:40 · now"). Today
 * gives the clock, and whether it is the current minute; any other day keeps
 * the full date ("Fri 23 Oct, 14:05"). The words around it are copy and live
 * in src/i18n (formatFieldTime).
 */
export type FieldTime =
  { day: 'today'; clock: string; now: boolean } | { day: 'other'; text: string };

export function fieldTime(at: number, now: number, tz: string, locale: string): FieldTime {
  if (dayBucket(at, now, tz).daysAgo !== 0) {
    return { day: 'other', text: formatDateTime(at, tz, locale) };
  }
  return { day: 'today', clock: formatClock(at, tz), now: Math.abs(now - at) < MINUTE_MS };
}

/**
 * What a date field says (direction G sheets/weight: "Today, 6 Oct"). Today
 * gives the day and month; any other day adds the weekday ("Fri 2 Oct"). The
 * "Today" around it is copy (formatFieldDate in src/i18n).
 */
export type FieldDate = { day: 'today'; date: string } | { day: 'other'; text: string };

export function fieldDate(at: number, now: number, tz: string, locale: string): FieldDate {
  const today = dayBucket(at, now, tz).daysAgo === 0;
  const text = new Intl.DateTimeFormat(locale, {
    ...(!today && { weekday: 'short' }),
    day: 'numeric',
    month: 'short',
    timeZone: tz,
  }).format(at);
  return today ? { day: 'today', date: text } : { day: 'other', text };
}
