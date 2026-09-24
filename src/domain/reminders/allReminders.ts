import {
  getActivity,
  type Event,
  type EventType,
  type ScheduledReminder,
  type Settings,
} from '../activities';

import { computeFeedReminders } from './feedReminders';

/**
 * Everything this phone should be holding (SDD 6.2): the feed reminders, plus
 * whatever each activity contributes for its own entries. One list, computed
 * in one place, because the scheduler reconciles against all of it at once —
 * a second list computed separately would cancel the first.
 *
 * Nothing here formats text: each reminder carries an i18n key, so what shows
 * on a lock screen is chosen at the edge and never contains health data.
 */
export function computeAllReminders(
  events: readonly Event<unknown>[],
  settings: Settings,
  now: number,
  tz: string,
): ScheduledReminder[] {
  if (!settings.enabled) return [];

  const byType = new Map<EventType, Event<unknown>[]>();
  for (const event of events) {
    const forType = byType.get(event.type);
    if (forType) forType.push(event);
    else byType.set(event.type, [event]);
  }

  const contributed = [...byType.entries()].flatMap(([type, ofType]) => {
    const module = getActivity(type);
    return module?.reminders?.(ofType, settings, now) ?? [];
  });

  return [...computeFeedReminders(events, settings, now, tz), ...contributed].sort(
    (a, b) => a.at - b.at || a.id.localeCompare(b.id),
  );
}
