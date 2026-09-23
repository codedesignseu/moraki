const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;

/** How old the oldest batch in a place is, for the stock card (SDD 6.3). */
export type MilkAge = { scale: 'hours' | 'days'; value: number };

/**
 * The age of the oldest milk still in a place: whole hours on the first day,
 * whole days after that. Pure, so the card renders the same on every phone.
 * Milk pumped in the future (a phone with a wrong clock) reads as 0 hours.
 */
export function milkAge(oldestAt: number, now: number): MilkAge {
  const elapsed = Math.max(0, now - oldestAt);
  return elapsed < DAY_MS
    ? { scale: 'hours', value: Math.floor(elapsed / HOUR_MS) }
    : { scale: 'days', value: Math.floor(elapsed / DAY_MS) };
}
