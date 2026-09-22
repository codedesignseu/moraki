import { EMPTY_STATS, getActivity, isBottleFeed, isFeed, isSleep, type Event } from '../activities';
import { coveredMs } from '../time/intervals';
import { dayBucket, fromWallClock, localDayKey, toWallClock } from '../time/zoned';

/** Today plus the 6 local days before it. */
export const INSIGHT_DAYS = 7;

export type DayTotals = {
  /** Feeds, a mixed bottle and breast feed counting once. */
  feeds: number;
  /** Bottle millilitres only. */
  ml: number;
  /** Breastfeeding time only; never combined with ml. */
  breastMs: number;
  wet: number;
  dirty: number;
  /** Time asleep within the day; overlapping sleeps count once. */
  sleepMs: number;
};

export type InsightDay = DayTotals & {
  /** Local calendar date, `YYYY-MM-DD`. */
  key: string;
  /** 6 for the oldest day, 0 for today. */
  daysAgo: number;
  /** UTC epoch ms of local midnight that began the day. */
  start: number;
};

export type WeekInsights = {
  /** Oldest first; the last is today, so far. */
  days: InsightDay[];
  totals: DayTotals;
  /** Mean millilitres per bottle feed in the window; null without bottles. */
  averageBottleMl: number | null;
  /**
   * Mean time between consecutive feeds in the window: (last - first) / (feeds - 1).
   * Null with fewer than two feeds.
   */
  averageIntervalMs: number | null;
};

/** Local midnight `daysAgo` calendar days before the day containing `now`. */
function localMidnight(now: number, daysAgo: number, tz: string): number {
  const today = toWallClock(now, tz);
  // Date.UTC rolls day 0 back into the previous month; only the date is used.
  const date = new Date(Date.UTC(today.year, today.month - 1, today.day - daysAgo));
  return fromWallClock(
    {
      year: date.getUTCFullYear(),
      month: date.getUTCMonth() + 1,
      day: date.getUTCDate(),
      hour: 0,
      minute: 0,
    },
    tz,
  );
}

const ZERO: DayTotals = { feeds: 0, ml: 0, breastMs: 0, wet: 0, dirty: 0, sleepMs: 0 };

/**
 * The insights view model (SDD 7, 6.5): the last 7 local days with bottle mL,
 * breastfeeding time, feeds, diapers and sleep per day, week totals, average
 * bottle and average interval between feeds. Days follow the same rule as
 * home's "today" (SDD 6.1), so today's figures match home. Pure: `now` and
 * `tz` are passed in, and nothing is stored.
 */
export function selectWeekInsights(
  events: readonly Event<unknown>[],
  now: number,
  tz: string,
): WeekInsights {
  const live = events.filter((e) => e.deletedAt === null);
  const sleeps = live
    .filter(isSleep)
    // A running sleep counts until now; each day below is clipped at now anyway.
    .map((e) => ({ start: e.occurredAt, end: e.endedAt ?? now }));

  // Each event on its local day (index = days ago); anything outside the window is dropped.
  const byDay: Event<unknown>[][] = Array.from({ length: INSIGHT_DAYS }, () => []);
  for (const e of live) {
    byDay[dayBucket(e.occurredAt, now, tz).daysAgo]?.push(e);
  }
  const inWindow = byDay.flat();

  const days: InsightDay[] = [];
  for (let daysAgo = INSIGHT_DAYS - 1; daysAgo >= 0; daysAgo -= 1) {
    const start = localMidnight(now, daysAgo, tz);
    // Today ends now; a past day at the next local midnight, 23 or 25 hours on a DST day.
    const end = daysAgo === 0 ? now : localMidnight(now, daysAgo - 1, tz);
    const stats = (byDay[daysAgo] ?? []).reduce(
      (acc, e) => getActivity(e.type)?.contributes?.stats?.(acc, e) ?? acc,
      EMPTY_STATS,
    );
    days.push({
      key: localDayKey(start, tz),
      daysAgo,
      start,
      feeds: new Set(stats.feedIds).size,
      ml: stats.ml,
      breastMs: stats.breastMs,
      wet: stats.wet,
      dirty: stats.dirty,
      sleepMs: coveredMs(sleeps, start, end),
    });
  }

  const totals = days.reduce<DayTotals>(
    (sum, day) => ({
      feeds: sum.feeds + day.feeds,
      ml: sum.ml + day.ml,
      breastMs: sum.breastMs + day.breastMs,
      wet: sum.wet + day.wet,
      dirty: sum.dirty + day.dirty,
      sleepMs: sum.sleepMs + day.sleepMs,
    }),
    ZERO,
  );

  const bottles = inWindow.filter(isBottleFeed);

  // One time per feed: the parts of a mixed feed share a group and count once.
  const feedTimes = new Map<string, number>();
  for (const e of inWindow.filter(isFeed)) {
    const id = e.groupId ?? e.id;
    feedTimes.set(id, Math.min(feedTimes.get(id) ?? e.occurredAt, e.occurredAt));
  }
  const times = [...feedTimes.values()];

  return {
    days,
    totals,
    averageBottleMl: bottles.length === 0 ? null : totals.ml / bottles.length,
    averageIntervalMs:
      times.length < 2 ? null : (Math.max(...times) - Math.min(...times)) / (times.length - 1),
  };
}
