const MINUTE_MS = 60_000;
const HOUR_MINUTES = 60;

/** Whole hours and the minutes left over, for a duration shown in words. */
export type DurationParts = { hours: number; minutes: number };

/**
 * Splits a duration into hours and minutes for display (SDD 6.6). Partial
 * minutes round down and seconds are never shown. Negative input (clock skew
 * between devices) is zero. The words around the numbers ("2 h 15 min",
 * "2 ώ 15 λ") are copy, so they live in src/i18n, not here.
 */
export function durationParts(ms: number): DurationParts {
  const totalMinutes = Math.max(0, Math.floor(ms / MINUTE_MS));
  return {
    hours: Math.floor(totalMinutes / HOUR_MINUTES),
    minutes: totalMinutes % HOUR_MINUTES,
  };
}
