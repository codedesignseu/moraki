import { isWeight, type Event } from '../activities';
import { startOfLocalDay } from '../time/zoned';

const DAY_MS = 86_400_000;

export type WeightPoint = {
  /** Days since the day the baby was born, in the household's timezone. */
  day: number;
  grams: number;
  /** Where the number came from, which is the only thing said about it. */
  source: 'home' | 'clinic';
  at: number;
};

export type WeightView = {
  points: WeightPoint[];
  birthGrams: number | null;
  latest: WeightPoint | null;
  /** Latest minus birth weight, in grams. Null without one or the other. */
  changeG: number | null;
};

/**
 * The weight view (SDD 6.4): every weight entry as a point, the latest one,
 * and the plain difference from the birth weight in grams. Pure — `tz`
 * decides which day an entry falls on, so an evening weighing doesn't land on
 * the next day.
 *
 * It says what was weighed and when, and nothing about whether that is good:
 * no reference line, no day to look at, no percentage of anything. No
 * judgement is computed here, because none belongs anywhere (rule 10).
 */
export function selectWeightView(
  events: readonly Event<unknown>[],
  birth: { bornAt: number; birthGrams: number | null },
  tz: string,
): WeightView {
  const bornDay = startOfLocalDay(birth.bornAt, tz);

  const points = events
    .filter((e) => e.deletedAt === null)
    .filter(isWeight)
    .sort((a, b) => a.occurredAt - b.occurredAt || a.id.localeCompare(b.id))
    .map((e) => ({
      day: Math.round((startOfLocalDay(e.occurredAt, tz) - bornDay) / DAY_MS),
      grams: e.payload.grams,
      source: e.payload.source,
      at: e.occurredAt,
    }));

  const latest = points.length > 0 ? (points[points.length - 1] ?? null) : null;

  return {
    points,
    birthGrams: birth.birthGrams,
    latest,
    changeG: latest && birth.birthGrams !== null ? latest.grams - birth.birthGrams : null,
  };
}
