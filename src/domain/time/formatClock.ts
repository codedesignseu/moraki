import { toWallClock } from './zoned';

/** Local 24-hour clock time for display, e.g. `14:05`. */
export function formatClock(epochMs: number, tz: string): string {
  const { hour, minute } = toWallClock(epochMs, tz);
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}
