import {
  isAppointment,
  isBottleFeed,
  isBreastFeed,
  isFeed,
  isHealth,
  isMedication,
  isSleep,
  type Event,
} from '../activities';
import type { HealthPayload } from '../activities/health';
import { selectWeekInsights, type DayTotals, type InsightDay } from '../insights/weekInsights';
import { breastDurationMs } from '../activities/feedBreast';
import { coveredMs } from '../time/intervals';
import { startOfLocalDay } from '../time/zoned';
import { selectWeightView } from '../weight/weightSeries';

const DAY_MS = 86_400_000;

export const REPORT_RANGES = ['24h', '3d', '7d'] as const;
export type ReportRange = (typeof REPORT_RANGES)[number];

/** How many local days a range covers, today included. */
const RANGE_DAYS: Record<ReportRange, number> = { '24h': 1, '3d': 3, '7d': 7 };

export type ReportBaby = {
  name: string;
  bornAt: number;
  birthWeightG: number | null;
};

export type ReportWeight = {
  birthGrams: number | null;
  latest: { grams: number; at: number; day: number } | null;
  /** Latest minus birth weight, and that as a percentage of it. */
  changeG: number | null;
  changePct: number | null;
};

export type ReportFeeds = {
  /** A mixed bottle and breast feed counts once. */
  count: number;
  bottleMl: number;
  breastMs: number;
  /** Longest time between consecutive feeds in the window, or null under two. */
  longestGapMs: number | null;
  lastAt: number | null;
};

export type ReportNote = {
  at: number;
  note: string | null;
  tempC: number | null;
  tags: NonNullable<HealthPayload['tags']>;
};

export type ReportMedication = { at: number; name: string; dose: string | null };

/** The next visit and what to ask at it (SDD 6.5 item 7, P3-13). */
export type ReportAppointment = {
  at: number;
  title: string;
  doctor: string | null;
  clinic: string | null;
  questions: string[];
};

export type Report = {
  range: ReportRange;
  /** The window the figures cover, in UTC epoch ms. */
  from: number;
  to: number;
  baby: { name: string; ageDays: number; bornAt: number };
  weight: ReportWeight;
  /** The call script's block: always the last 24 hours, whatever the range. */
  last24h: { feeds: ReportFeeds; wet: number; dirty: number };
  /** The same figures over the whole range. */
  window: { feeds: ReportFeeds; wet: number; dirty: number; sleepMs: number };
  /** Per-day rows, oldest first. One row for 24h, three for 3d, seven for 7d. */
  days: InsightDay[];
  averageBottleMl: number | null;
  averageIntervalMs: number | null;
  /** The most recent temperature in the window, or null. */
  lastTemperature: { celsius: number; at: number } | null;
  /** Health notes and medication in the window, oldest first. */
  notes: ReportNote[];
  medications: ReportMedication[];
  /**
   * The next appointment still to come, with the questions saved on it. Not
   * bounded by the range: the call script exists to be read while talking to
   * a clinic, and what someone meant to ask is the point of the call.
   */
  appointment: ReportAppointment | null;
};

const inWindow = (from: number, to: number) => (e: Event<unknown>) =>
  e.occurredAt >= from && e.occurredAt <= to;

const byTime = (a: Event<unknown>, b: Event<unknown>) =>
  a.occurredAt - b.occurredAt || a.id.localeCompare(b.id);

/** Feeds, millilitres, breastfeeding time and the longest gap in one window. */
function feedsIn(live: readonly Event<unknown>[], from: number, to: number): ReportFeeds {
  const feeds = live.filter(inWindow(from, to)).filter(isFeed).sort(byTime);
  const sessions = new Set(feeds.map((e) => e.groupId ?? e.id));
  const starts = [...new Set(feeds.map((e) => e.occurredAt))].sort((a, b) => a - b);
  const gaps = starts.slice(1).map((at, i) => at - (starts[i] as number));
  return {
    count: sessions.size,
    bottleMl: feeds.filter(isBottleFeed).reduce((sum, e) => sum + e.payload.ml, 0),
    breastMs: feeds.filter(isBreastFeed).reduce((sum, e) => sum + breastDurationMs(e), 0),
    longestGapMs: gaps.length > 0 ? Math.max(...gaps) : null,
    lastAt: feeds.length > 0 ? (feeds[feeds.length - 1]?.occurredAt ?? null) : null,
  };
}

function diapersIn(live: readonly Event<unknown>[], from: number, to: number) {
  const kinds = live
    .filter(inWindow(from, to))
    .filter((e) => e.type === 'diaper')
    .map((e) => (e.payload as { kind: 'wet' | 'dirty' | 'both' }).kind);
  return {
    wet: kinds.filter((k) => k === 'wet' || k === 'both').length,
    dirty: kinds.filter((k) => k === 'dirty' || k === 'both').length,
  };
}

/**
 * The report object both the screen and the PDF render (SDD 6.5). Pure: `now`
 * and `tz` are passed in, nothing is stored, and no text is formatted here —
 * the renderers do that, so one report can be read in either language.
 *
 * It reports what was logged and nothing about what it means: no figure is
 * marked as high, low or worth worrying about (rule 10).
 */
export function buildReport(
  events: readonly Event<unknown>[],
  baby: ReportBaby,
  range: ReportRange,
  now: number,
  tz: string,
): Report {
  const live = events.filter((e) => e.deletedAt === null);
  const days = RANGE_DAYS[range];
  // 24h is a rolling day; the longer ranges start at a local midnight, so the
  // per-day rows are whole days a caregiver can recognise.
  const from = range === '24h' ? now - DAY_MS : startOfLocalDay(now, tz) - (days - 1) * DAY_MS;

  const week = selectWeekInsights(live, now, tz);
  const weightView = selectWeightView(
    live,
    { bornAt: baby.bornAt, birthGrams: baby.birthWeightG },
    tz,
  );
  const latest = weightView.latest;

  const health = live.filter(inWindow(from, now)).filter(isHealth).sort(byTime);
  const temperatures = health.filter((e) => e.payload.temp_c !== undefined);
  const lastTemp = temperatures[temperatures.length - 1];

  const sleepMs = coveredMs(
    live.filter(isSleep).map((e) => ({ start: e.occurredAt, end: e.endedAt ?? now })),
    from,
    now,
  );

  return {
    range,
    from,
    to: now,
    baby: {
      name: baby.name,
      bornAt: baby.bornAt,
      ageDays: Math.max(
        0,
        Math.round((startOfLocalDay(now, tz) - startOfLocalDay(baby.bornAt, tz)) / DAY_MS),
      ),
    },
    weight: {
      birthGrams: baby.birthWeightG,
      latest: latest ? { grams: latest.grams, at: latest.at, day: latest.day } : null,
      changeG: weightView.changeG,
      changePct:
        latest && baby.birthWeightG !== null && latest.pctOfBirth !== null
          ? Math.round((latest.pctOfBirth - 100) * 10) / 10
          : null,
    },
    last24h: { feeds: feedsIn(live, now - DAY_MS, now), ...diapersIn(live, now - DAY_MS, now) },
    window: { feeds: feedsIn(live, from, now), ...diapersIn(live, from, now), sleepMs },
    days: week.days.slice(-days),
    averageBottleMl: week.averageBottleMl,
    averageIntervalMs: week.averageIntervalMs,
    lastTemperature:
      lastTemp && lastTemp.payload.temp_c !== undefined
        ? { celsius: lastTemp.payload.temp_c, at: lastTemp.occurredAt }
        : null,
    notes: health.map((e) => ({
      at: e.occurredAt,
      note: e.payload.note ?? null,
      tempC: e.payload.temp_c ?? null,
      tags: e.payload.tags ?? [],
    })),
    appointment: (() => {
      const next = live
        .filter(isAppointment)
        .filter((e) => e.occurredAt > now)
        .reduce<(typeof live)[number] | null>(
          (soonest, e) => (soonest === null || e.occurredAt < soonest.occurredAt ? e : soonest),
          null,
        );
      if (next === null || !isAppointment(next)) return null;
      return {
        at: next.occurredAt,
        title: next.payload.title,
        doctor: next.payload.doctor ?? null,
        clinic: next.payload.clinic ?? null,
        questions: next.payload.questions ?? [],
      };
    })(),
    medications: live
      .filter(inWindow(from, now))
      .filter(isMedication)
      .sort(byTime)
      .map((e) => ({ at: e.occurredAt, name: e.payload.name, dose: e.payload.dose ?? null })),
  };
}

export type { DayTotals };
