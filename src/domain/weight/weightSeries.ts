import { isWeight, type Event } from '../activities';
import { startOfLocalDay } from '../time/zoned';

const DAY_MS = 86_400_000;

export type WeightPoint = {
  /** Days since the day the baby was born, in the household's timezone. */
  day: number;
  grams: number;
  /** Where the number came from, which is the only thing said about it. */
  source: 'home' | 'clinic';
  /** Of the birth weight, to one decimal place. Null without a birth weight. */
  pctOfBirth: number | null;
  at: number;
};

export type WeightReference = {
  /** The birth weight itself and 90% of it, the two lines a clinician uses. */
  grams: number;
  pctOfBirth: number;
};

export type WeightView = {
  points: WeightPoint[];
  birthGrams: number | null;
  /** Empty without a birth weight: a percentage of nothing says nothing. */
  references: WeightReference[];
  /** The days a clinician looks at, for markers on the chart. */
  markerDays: number[];
  latest: WeightPoint | null;
  /** Latest minus birth weight, in grams. Null without one or the other. */
  changeG: number | null;
};

/** The days regain is usually looked at (SDD 6.4). */
export const MARKER_DAYS = [10, 14];

/** The reference lines: back to birth weight, and 90% of it (SDD 6.4). */
const REFERENCE_PERCENTS = [90, 100];

const round1 = (n: number) => Math.round(n * 10) / 10;

/**
 * The weight regain view (SDD 6.4): every weight entry as a point, with the
 * reference lines and the days to mark. Pure — `tz` decides which day an
 * entry falls on, so an evening weighing doesn't land on the next day.
 *
 * It says what was weighed and when, and nothing about whether that is good:
 * no judgement is computed here, because none belongs anywhere.
 */
export function selectWeightView(
  events: readonly Event<unknown>[],
  birth: { bornAt: number; birthGrams: number | null },
  tz: string,
): WeightView {
  const bornDay = startOfLocalDay(birth.bornAt, tz);
  const pct = (grams: number) =>
    birth.birthGrams === null ? null : round1((grams / birth.birthGrams) * 100);

  const points = events
    .filter((e) => e.deletedAt === null)
    .filter(isWeight)
    .sort((a, b) => a.occurredAt - b.occurredAt || a.id.localeCompare(b.id))
    .map((e) => ({
      day: Math.round((startOfLocalDay(e.occurredAt, tz) - bornDay) / DAY_MS),
      grams: e.payload.grams,
      source: e.payload.source,
      pctOfBirth: pct(e.payload.grams),
      at: e.occurredAt,
    }));

  const latest = points.length > 0 ? (points[points.length - 1] ?? null) : null;

  return {
    points,
    birthGrams: birth.birthGrams,
    references:
      birth.birthGrams === null
        ? []
        : REFERENCE_PERCENTS.map((percent) => ({
            grams: Math.round((birth.birthGrams as number) * (percent / 100)),
            pctOfBirth: percent,
          })),
    markerDays: MARKER_DAYS,
    latest,
    changeG: latest && birth.birthGrams !== null ? latest.grams - birth.birthGrams : null,
  };
}
