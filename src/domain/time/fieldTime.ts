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
