const SECOND_MS = 1000;

const pad = (n: number) => String(n).padStart(2, '0');

/**
 * A running timer as hours, minutes and seconds, e.g. `1:05:12` (the Home
 * sleep card, direction G). Figures only, so it reads the same in every
 * language. Partial seconds round down; negative input (clock skew) is
 * `0:00:00`.
 */
export function formatStopwatch(elapsedMs: number): string {
  const total = Math.max(0, Math.floor(elapsedMs / SECOND_MS));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  return `${hours}:${pad(minutes)}:${pad(seconds)}`;
}
