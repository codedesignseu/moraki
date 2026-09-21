const MINUTE_MS = 60_000;
const DAY_MS = 86_400_000;

/** Local calendar date and time in one timezone. `month` is 1..12. Minute precision. */
export type WallClock = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
};

/**
 * Which occurrence to pick when a wall-clock time happens twice, as in the
 * repeated hour when clocks go back. A time skipped when clocks go forward
 * always resolves to the instant just after the gap (Temporal's "compatible").
 */
export type Disambiguation = 'earlier' | 'later';

const formatters = new Map<string, Intl.DateTimeFormat>();

// Every conversion goes through Intl with an explicit timeZone, so results
// never depend on the process or device timezone (SDD 6.6).
function formatterFor(tz: string): Intl.DateTimeFormat {
  let formatter = formatters.get(tz);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hourCycle: 'h23',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
    });
    formatters.set(tz, formatter);
  }
  return formatter;
}

function partsAt(epochMs: number, tz: string): WallClock & { second: number } {
  const values: Record<string, number> = {};
  for (const part of formatterFor(tz).formatToParts(epochMs)) {
    if (part.type !== 'literal') values[part.type] = Number(part.value);
  }
  return {
    year: values.year ?? 0,
    month: values.month ?? 0,
    day: values.day ?? 0,
    // Some engines render midnight as 24 even with h23.
    hour: (values.hour ?? 0) % 24,
    minute: values.minute ?? 0,
    second: values.second ?? 0,
  };
}

function wallAsUtc(wall: WallClock): number {
  return Date.UTC(wall.year, wall.month - 1, wall.day, wall.hour, wall.minute);
}

/** Offset from UTC in minutes at an instant, e.g. 180 for Nicosia in summer. */
export function offsetMinutes(epochMs: number, tz: string): number {
  const { second, ...wall } = partsAt(epochMs, tz);
  // The formatted parts describe the instant floored to the second.
  const flooredToSecond = Math.floor(epochMs / 1000) * 1000;
  return (wallAsUtc(wall) + second * 1000 - flooredToSecond) / MINUTE_MS;
}

/** UTC instant to the local date and time shown to the user. Seconds are dropped. */
export function toWallClock(epochMs: number, tz: string): WallClock {
  const { second: _second, ...wall } = partsAt(epochMs, tz);
  return wall;
}

function sameWall(a: WallClock, b: WallClock): boolean {
  return (
    a.year === b.year &&
    a.month === b.month &&
    a.day === b.day &&
    a.hour === b.hour &&
    a.minute === b.minute
  );
}

/**
 * Local date and time, as picked in a form, to the UTC instant to store.
 * Ambiguous times follow `disambiguation`; skipped times land just after the gap.
 */
export function fromWallClock(
  wall: WallClock,
  tz: string,
  disambiguation: Disambiguation = 'earlier',
): number {
  const naive = wallAsUtc(wall);
  // Offsets a day either side bracket any transition near this wall time.
  const offsetBefore = offsetMinutes(naive - DAY_MS, tz);
  const offsetAfter = offsetMinutes(naive + DAY_MS, tz);
  const candidates = [...new Set([offsetBefore, offsetAfter])]
    .map((offset) => naive - offset * MINUTE_MS)
    .filter((instant) => sameWall(toWallClock(instant, tz), wall))
    .sort((a, b) => a - b);

  const first = candidates[0];
  const last = candidates[candidates.length - 1];
  if (first !== undefined && last !== undefined) {
    return disambiguation === 'earlier' ? first : last;
  }
  // In a gap: read the wall time with the offset in force before the jump.
  return naive - offsetBefore * MINUTE_MS;
}

/** The instant local midnight began on the local day containing `epochMs`. */
export function startOfLocalDay(epochMs: number, tz: string): number {
  const { year, month, day } = toWallClock(epochMs, tz);
  return fromWallClock({ year, month, day, hour: 0, minute: 0 }, tz);
}

/** Local calendar date as `YYYY-MM-DD`, the key for grouping by day. */
export function localDayKey(epochMs: number, tz: string): string {
  const { year, month, day } = toWallClock(epochMs, tz);
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export type DayBucket = {
  /** Local calendar date of the event, `YYYY-MM-DD`. */
  key: string;
  /** 0 today, 1 yesterday, and so on; negative for a future local day. */
  daysAgo: number;
};

/**
 * The local day an event falls on relative to `now`. "Today" means since local
 * midnight in `tz` (SDD 6.1), not the last 24 hours and not the UTC date.
 * Days are counted on the calendar, so a 23 or 25 hour DST day is still one day.
 */
export function dayBucket(epochMs: number, now: number, tz: string): DayBucket {
  const event = toWallClock(epochMs, tz);
  const today = toWallClock(now, tz);
  const eventDate = Date.UTC(event.year, event.month - 1, event.day);
  const todayDate = Date.UTC(today.year, today.month - 1, today.day);
  return {
    key: localDayKey(epochMs, tz),
    daysAgo: Math.round((todayDate - eventDate) / DAY_MS),
  };
}
