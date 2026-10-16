import type { TFunction } from 'i18next';

/**
 * A sheet's time field in words: "Today, 22:40 · now", "Today, 21:50", or the
 * full date for another day. Which of these applies is domain logic
 * (fieldTime in src/domain/time); the words are copy, so they live here.
 */
export function formatFieldTime(
  t: TFunction,
  time: { day: 'today'; clock: string; now: boolean } | { day: 'other'; text: string },
): string {
  if (time.day === 'other') return time.text;
  return t(time.now ? 'log.when.todayNow' : 'log.when.today', { time: time.clock });
}
