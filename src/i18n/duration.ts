import type { TFunction } from 'i18next';

/**
 * `long`: "2 h 15 min" (the Home hero). `short`: "1 h 05", minutes padded to
 * two digits (the sleep tile's "Awake 1 h 05"). Under an hour both read
 * "42 min".
 */
export type DurationStyle = 'long' | 'short';

/**
 * A duration in words, in the current language ("2 h 15 min", "2 ώ 15 λ").
 * The split into hours and minutes is domain logic (durationParts in
 * src/domain/time); the words around the numbers are copy, so they live here.
 */
export function formatDuration(
  t: TFunction,
  parts: { hours: number; minutes: number },
  style: DurationStyle = 'long',
): string {
  const { hours, minutes } = parts;
  if (hours === 0) return t('duration.minutes', { minutes });
  return style === 'short'
    ? t('duration.short', { hours, minutes: String(minutes).padStart(2, '0') })
    : t('duration.long', { hours, minutes });
}
