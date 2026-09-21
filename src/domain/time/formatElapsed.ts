const MINUTE_MS = 60_000;
const HOUR_MINUTES = 60;

/**
 * Timer display for the home card (SDD 6.6): `42m` under an hour,
 * otherwise `2h 18m`. Never shows seconds. Partial minutes round down.
 * Negative input (clock skew between devices) displays as `0m`.
 */
export function formatElapsed(elapsedMs: number): string {
  const totalMinutes = Math.max(0, Math.floor(elapsedMs / MINUTE_MS));
  if (totalMinutes < HOUR_MINUTES) {
    return `${totalMinutes}m`;
  }
  const hours = Math.floor(totalMinutes / HOUR_MINUTES);
  const minutes = totalMinutes % HOUR_MINUTES;
  return `${hours}h ${minutes}m`;
}
