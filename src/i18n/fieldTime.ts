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

/** A sheet's date field in words: "Today, 6 Oct", or the date with its weekday for another day. */
export function formatFieldDate(
  t: TFunction,
  date: { day: 'today'; date: string } | { day: 'other'; text: string },
): string {
  return date.day === 'other' ? date.text : t('log.when.todayDate', { date: date.date });
}
