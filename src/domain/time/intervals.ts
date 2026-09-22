/** A span of time in UTC epoch ms, `start` inclusive, `end` exclusive. */
export type Interval = { start: number; end: number };

/**
 * Total time covered by the intervals inside [from, to), counting time shared
 * by overlapping intervals once. Intervals are clipped to the window first.
 */
export function coveredMs(intervals: readonly Interval[], from: number, to: number): number {
  const clipped = intervals
    .map(({ start, end }) => ({ start: Math.max(start, from), end: Math.min(end, to) }))
    .filter(({ start, end }) => end > start)
    .sort((a, b) => a.start - b.start);

  let total = 0;
  let runStart = 0;
  let runEnd = Number.NEGATIVE_INFINITY;
  for (const { start, end } of clipped) {
    if (start > runEnd) {
      // A gap: close the current run and start a new one.
      if (runEnd > runStart) total += runEnd - runStart;
      runStart = start;
      runEnd = end;
    } else {
      runEnd = Math.max(runEnd, end);
    }
  }
  if (runEnd > runStart) total += runEnd - runStart;
  return total;
}
