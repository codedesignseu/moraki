import { latestFeed, type Event, type ScheduledReminder, type Settings } from '../activities';
import { formatClock } from '../time/formatClock';

const MINUTE_MS = 60_000;

/**
 * When the next feed may be due, and the optional second reminder, counted
 * from the start of the last feed. Durations are elapsed time (rule 5), so a
 * 3-hour interval across a DST change is still 3 hours. Shared by the home
 * reminder line and the notification scheduler, so they always agree.
 */
export function feedDueTimes(
  events: readonly Event<unknown>[],
  intervalMin: number,
  secondReminderMin: number | null,
): { lastFeedAt: number; first: number; second: number | null } | null {
  const last = latestFeed(events);
  if (!last) return null;
  const first = last.occurredAt + intervalMin * MINUTE_MS;
  return {
    lastFeedAt: last.occurredAt,
    first,
    second: secondReminderMin === null ? null : first + secondReminderMin * MINUTE_MS,
  };
}

/**
 * The feed reminders to schedule now (SDD 6.2). Called on every change to
 * events or settings; the scheduler cancels everything in category `feed` and
 * schedules exactly this list. Only future times are returned. Each phone runs
 * this on the same events, so every caregiver gets the same times.
 */
export function computeFeedReminders(
  events: readonly Event<unknown>[],
  settings: Settings,
  now: number,
  tz: string,
): ScheduledReminder[] {
  if (!settings.enabled) return [];
  const due = feedDueTimes(events, settings.intervalMin, settings.secondReminderMin);
  if (!due) return [];
  const reminders: ScheduledReminder[] = [];
  if (due.first > now) {
    reminders.push({
      id: 'feed:first',
      category: 'feed',
      at: due.first,
      bodyKey: 'reminders.feed.first',
    });
  }
  if (due.second !== null && due.second > now) {
    reminders.push({
      id: 'feed:second',
      category: 'feed',
      at: due.second,
      bodyKey: 'reminders.feed.second',
      values: { time: formatClock(due.lastFeedAt, tz) },
    });
  }
  return reminders;
}
