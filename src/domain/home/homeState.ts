import {
  EMPTY_STATS,
  getActivity,
  isBreastFeed,
  isFeed,
  isSleep,
  type Event,
  type EventType,
  type FeedEvent,
} from '../activities';
import type { SleepPayload } from '../activities/sleep';
import { dayBucket } from '../time/zoned';

const MINUTE_MS = 60_000;
const DAY_MS = 24 * 60 * MINUTE_MS;

export type HomeSettings = {
  /** Household feed reminder interval (SDD 4.2 default 180). */
  reminderIntervalMin: number;
  /** Optional second reminder after the first, or null. */
  secondReminderMin: number | null;
};

export type HomeState = {
  /** Latest live bottle or breast feed by occurred time. */
  lastFeed: FeedEvent | null;
  sinceLastFeedMs: number | null;
  /** Opposite of the last breast side in the last 24 hours; null if none, or if it was both. */
  nextSide: 'left' | 'right' | null;
  /** UTC epoch ms. */
  reminderAt: number | null;
  secondReminderAt: number | null;
  /**
   * feeds, bottle ml, breastfeeding time, wet and dirty since local midnight;
   * sleep over the last 24 hours. ml and breastMs are separate totals.
   */
  today: {
    feeds: number;
    ml: number;
    breastMs: number;
    wet: number;
    dirty: number;
    sleepMs24h: number;
  };
  activeSleep: Event<SleepPayload> | null;
  /** The most recently logged live entry. */
  lastEntry: { type: EventType; by: string; at: number } | null;
};

const latest = <E extends Event<unknown>>(events: E[], key: (e: E) => number): E | null =>
  events.reduce<E | null>((best, e) => (best === null || key(e) > key(best) ? e : best), null);

/**
 * The home screen's view model (SDD 6.1). Pure: everything is derived from the
 * events, `now` (UTC epoch ms) and the device timezone, and nothing is stored.
 * Milk stock joins with the stock fold (P3-01).
 */
export function selectHomeState(
  events: readonly Event<unknown>[],
  now: number,
  tz: string,
  settings: HomeSettings,
): HomeState {
  const live = events.filter((e) => e.deletedAt === null);

  const lastFeed = latest(live.filter(isFeed), (e) => e.occurredAt);
  const reminderAt =
    lastFeed === null ? null : lastFeed.occurredAt + settings.reminderIntervalMin * MINUTE_MS;
  const secondReminderAt =
    reminderAt === null || settings.secondReminderMin === null
      ? null
      : reminderAt + settings.secondReminderMin * MINUTE_MS;

  const lastBreast = latest(
    live.filter(isBreastFeed).filter((e) => e.occurredAt >= now - DAY_MS),
    (e) => e.occurredAt,
  );
  const opposite = { left: 'right', right: 'left', both: null } as const;
  const nextSide = lastBreast === null ? null : opposite[lastBreast.payload.side];

  const stats = live
    .filter((e) => dayBucket(e.occurredAt, now, tz).daysAgo === 0)
    .reduce((acc, e) => getActivity(e.type)?.contributes?.stats?.(acc, e) ?? acc, EMPTY_STATS);

  const sleeps = live.filter(isSleep);
  const windowStart = now - DAY_MS;
  const sleepMs24h = sleeps.reduce((total, e) => {
    const start = Math.max(e.occurredAt, windowStart);
    const end = Math.min(e.endedAt ?? now, now);
    return total + Math.max(0, end - start);
  }, 0);

  const entry = latest(live, (e) => e.clientCreatedAt);

  return {
    lastFeed,
    sinceLastFeedMs: lastFeed === null ? null : now - lastFeed.occurredAt,
    nextSide,
    reminderAt,
    secondReminderAt,
    today: {
      feeds: new Set(stats.feedIds).size,
      ml: stats.ml,
      breastMs: stats.breastMs,
      wet: stats.wet,
      dirty: stats.dirty,
      sleepMs24h,
    },
    activeSleep: latest(
      sleeps.filter((e) => e.endedAt === null),
      (e) => e.occurredAt,
    ),
    lastEntry:
      entry === null ? null : { type: entry.type, by: entry.createdBy, at: entry.occurredAt },
  };
}
