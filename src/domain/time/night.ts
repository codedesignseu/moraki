import { fromWallClock, toWallClock } from './zoned';

/** Night mode setting (SDD 7): automatic between 21:00 and 06:00 local, or forced on or off. */
export const NIGHT_MODES = ['auto', 'on', 'off'] as const;
export type NightMode = (typeof NIGHT_MODES)[number];
export const DEFAULT_NIGHT_MODE: NightMode = 'auto';

/** Local hours of the automatic night: from 21:00 up to, not including, 06:00. */
export const NIGHT_HOURS = { startHour: 21, endHour: 6 } as const;

/** Whether `now` falls in the automatic night in `tz`. */
export function isNight(now: number, tz: string): boolean {
  const { hour } = toWallClock(now, tz);
  return hour >= NIGHT_HOURS.startHour || hour < NIGHT_HOURS.endHour;
}

/** The palette to show: `night` or `light`. */
export function nightScheme(mode: NightMode, now: number, tz: string): 'night' | 'light' {
  if (mode === 'on') return 'night';
  if (mode === 'off') return 'light';
  return isNight(now, tz) ? 'night' : 'light';
}

/**
 * The next instant after `now` at which `isNight` changes: the coming 21:00 or
 * 06:00 local. Found through the wall clock, so a DST change during the night
 * moves the instant, not the local time.
 */
export function nextNightChange(now: number, tz: string): number {
  const { year, month, day, hour } = toWallClock(now, tz);
  // Before 06:00 the night ends today; from 21:00 it ends tomorrow.
  const days = hour >= NIGHT_HOURS.startHour ? 1 : 0;
  const boundary = isNight(now, tz) ? NIGHT_HOURS.endHour : NIGHT_HOURS.startHour;
  // Date.UTC rolls day 32 into the next month; only the calendar date is used.
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return fromWallClock(
    {
      year: date.getUTCFullYear(),
      month: date.getUTCMonth() + 1,
      day: date.getUTCDate(),
      hour: boundary,
      minute: 0,
    },
    tz,
  );
}
