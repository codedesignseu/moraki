import type { Event, EventType } from '../activities';
import { MARKER_DAYS, selectWeightView } from './weightSeries';

const TZ = 'Europe/Nicosia';
const DAY = 86_400_000;
/** Born at 03:10 local on 1 June 2026. */
const BORN = Date.parse('2026-06-01T00:10:00Z');
const BIRTH_G = 3400;

let n = 0;
function weighed(day: number, grams: number, source: 'home' | 'clinic' = 'home', hour = 9) {
  n += 1;
  return {
    id: `w${String(n).padStart(3, '0')}`,
    householdId: 'h',
    babyId: 'b',
    type: 'weight' as EventType,
    occurredAt: BORN + day * DAY + (hour - 3) * 3_600_000,
    endedAt: null,
    payload: { grams, source },
    groupId: null,
    createdBy: 'u',
    updatedBy: 'u',
    clientCreatedAt: BORN + day * DAY,
    deletedAt: null as number | null,
  } satisfies Event<{ grams: number; source: 'home' | 'clinic' }>;
}

/**
 * A real-shaped first three weeks: the usual dip in the first days, back to
 * birth weight around day 12, then steady gain. Home scales in between the
 * clinic's.
 */
const firstThreeWeeks = [
  weighed(0, 3400, 'clinic'),
  weighed(2, 3180, 'clinic'),
  weighed(4, 3105, 'home'),
  weighed(6, 3160, 'home'),
  weighed(10, 3300, 'clinic'),
  weighed(12, 3410, 'home'),
  weighed(14, 3510, 'clinic'),
  weighed(18, 3720, 'home'),
  weighed(21, 3900, 'clinic'),
];

const view = (events = firstThreeWeeks, birthGrams: number | null = BIRTH_G) =>
  selectWeightView(events, { bornAt: BORN, birthGrams }, TZ);

describe('the weight series over the first three weeks', () => {
  it('puts every weighing on the day it happened, oldest first', () => {
    expect(view().points.map((p) => p.day)).toEqual([0, 2, 4, 6, 10, 12, 14, 18, 21]);
  });

  it('gives each point its grams, where it came from, and the share of birth weight', () => {
    const points = view().points;
    expect(points[0]).toMatchObject({ day: 0, grams: 3400, source: 'clinic', pctOfBirth: 100 });
    // The low point of the dip: 3105 of 3400.
    expect(points[2]).toMatchObject({ day: 4, grams: 3105, source: 'home', pctOfBirth: 91.3 });
    expect(points[8]).toMatchObject({ day: 21, grams: 3900, pctOfBirth: 114.7 });
  });

  it('draws the two lines a clinician uses, and marks day 10 and day 14', () => {
    expect(view().references).toEqual([
      { grams: 3060, pctOfBirth: 90 },
      { grams: 3400, pctOfBirth: 100 },
    ]);
    expect(view().markerDays).toEqual(MARKER_DAYS);
  });

  it('reports the latest weighing and the change from birth', () => {
    expect(view().latest).toMatchObject({ day: 21, grams: 3900 });
    expect(view().changeG).toBe(500);
  });

  it('reports a loss as a loss, without a word about it', () => {
    const early = firstThreeWeeks.slice(0, 3);
    expect(view(early).changeG).toBe(-295);
    // Nothing in the view model says whether that is fine. That is the point.
    expect(Object.keys(view(early).points[0] ?? {}).sort()).toEqual([
      'at',
      'day',
      'grams',
      'pctOfBirth',
      'source',
    ]);
  });
});

describe('the awkward cases', () => {
  it('has nothing to show before the first weighing', () => {
    expect(view([])).toMatchObject({ points: [], latest: null, changeG: null });
    // The lines still stand: they come from the birth weight, not the entries.
    expect(view([]).references).toHaveLength(2);
  });

  it('leaves out the percentages when no birth weight was recorded', () => {
    const noBirth = view(firstThreeWeeks, null);
    expect(noBirth.points.every((p) => p.pctOfBirth === null)).toBe(true);
    expect(noBirth.references).toEqual([]);
    expect(noBirth.changeG).toBe(null);
  });

  it('keeps an evening weighing on its own day, not the next one', () => {
    // 23:30 local on day 3, which is already the next day in UTC.
    const late = weighed(3, 3120, 'home', 23.5);
    expect(view([late]).points[0]?.day).toBe(3);
  });

  it('forgets a weighing that was deleted', () => {
    const [first, second] = firstThreeWeeks;
    if (!first || !second) throw new Error('fixture');
    const points = view([first, { ...second, deletedAt: BORN + 5 * DAY }]).points;
    expect(points).toHaveLength(1);
    expect(points[0]?.day).toBe(0);
  });

  it('orders two weighings on the same day by when they happened', () => {
    const morning = weighed(5, 3200, 'home', 8);
    const evening = weighed(5, 3240, 'home', 20);
    const points = view([evening, morning]).points;
    expect(points.map((p) => p.grams)).toEqual([3200, 3240]);
    expect(points.every((p) => p.day === 5)).toBe(true);
  });

  it('counts a weighing before the birth date as a day before it', () => {
    // A mistyped date shouldn't be silently moved onto day 0.
    expect(view([weighed(-1, 3400, 'clinic')]).points[0]?.day).toBe(-1);
  });
});
