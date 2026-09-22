/**
 * Waits between pushes that didn't reach the server (SDD 5.2): 2s, 5s, 15s,
 * 60s, then every 5 minutes. Reset on reconnect or foreground, so a phone
 * that comes back tries at once instead of waiting out the last step.
 */
export const BACKOFF_MS = [2_000, 5_000, 15_000, 60_000, 300_000] as const;

/** The wait after `failures` tries in a row, the last step repeating. */
export function backoffMs(failures: number): number {
  const step = Math.min(Math.max(failures, 1), BACKOFF_MS.length) - 1;
  return BACKOFF_MS[step]!;
}
