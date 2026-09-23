import type { Event, EventType } from '../activities';
import { buildReport, type ReportRange } from './buildReport';

// Every expected figure below was worked out by hand from the fixture and
// written next to it, never read back from the code. Nicosia is UTC+3 here
// (before the 25 October change).
const TZ = 'Europe/Nicosia';
const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
const at = (iso: string) => Date.parse(iso);

/** Wednesday 21 October 2026, 14:00 local. */
const NOW = at('2026-10-21T14:00:00+03:00');
/** Born 12 days before that, so the baby is 12 days old. */
const BORN = at('2026-10-09T06:20:00+03:00');
const BABY = { name: 'Ella', bornAt: BORN, birthWeightG: 3400 };

let seq = 0;
function ev<P>(type: EventType, iso: string, payload: P, extra: Partial<Event<P>> = {}): Event<P> {
  seq += 1;
  return {
    id: `e${String(seq).padStart(3, '0')}`,
    householdId: 'h',
    babyId: 'b',
    type,
    occurredAt: at(iso),
    endedAt: null,
    payload,
    groupId: null,
    createdBy: 'me',
    updatedBy: 'me',
    clientCreatedAt: at(iso),
    deletedAt: null,
    ...extra,
  };
}
const bottle = (iso: string, ml: number, extra = {}) =>
  ev('feed_bottle', iso, { ml, milk: 'formula' }, extra);
const breast = (iso: string, minutes: number, extra = {}) =>
  ev('feed_breast', iso, { side: 'left' }, { endedAt: at(iso) + minutes * MIN, ...extra });
const diaper = (iso: string, kind: 'wet' | 'dirty' | 'both') => ev('diaper', iso, { kind });
const sleep = (from: string, to: string) => ev('sleep', from, {}, { endedAt: at(to) });
const weight = (iso: string, grams: number, source: 'home' | 'clinic' = 'clinic') =>
  ev('weight', iso, { grams, source });

const events: Event<unknown>[] = [
  // Day 19 October (outside every window except 7d).
  bottle('2026-10-19T09:00:00+03:00', 70),
  weight('2026-10-19T10:00:00+03:00', 3300),

  // Tuesday 20 October, before the rolling 24 hours (which starts 14:00).
  bottle('2026-10-20T08:00:00+03:00', 80),
  diaper('2026-10-20T08:10:00+03:00', 'wet'),
  sleep('2026-10-20T22:00:00+03:00', '2026-10-21T01:00:00+03:00'), // 3h, spans midnight

  // The rolling 24 hours: 14:00 Tuesday to 14:00 Wednesday.
  bottle('2026-10-20T18:00:00+03:00', 90),
  diaper('2026-10-20T18:30:00+03:00', 'both'), // counts as one wet and one dirty
  // A mixed feed: one session, two events.
  bottle('2026-10-21T02:00:00+03:00', 60, { groupId: 'g1' }),
  breast('2026-10-21T02:00:00+03:00', 20, { groupId: 'g1' }),
  diaper('2026-10-21T03:00:00+03:00', 'wet'),
  ev('health', '2026-10-21T04:00:00+03:00', { temp_c: 37.2, note: 'Warm after a feed' }),
  ev('medication', '2026-10-21T04:30:00+03:00', { name: 'Vitamin D', dose: '1 drop' }),
  breast('2026-10-21T09:00:00+03:00', 25),
  ev('health', '2026-10-21T10:00:00+03:00', { temp_c: 36.9 }),
  diaper('2026-10-21T11:00:00+03:00', 'dirty'),
  weight('2026-10-21T12:00:00+03:00', 3510),
  bottle('2026-10-21T13:00:00+03:00', 100),
];

const report = (range: ReportRange = '24h', list = events) =>
  buildReport(list, BABY, range, NOW, TZ);

describe('the call script block', () => {
  it('gives the baby’s age in whole days', () => {
    expect(report().baby).toEqual({ name: 'Ella', bornAt: BORN, ageDays: 12 });
  });

  it('gives birth weight, the latest weighing and the change', () => {
    // 3510 of 3400 is 110 g and 103.2%, so 3.2 points above birth weight.
    expect(report().weight).toEqual({
      birthGrams: 3400,
      latest: { grams: 3510, at: at('2026-10-21T12:00:00+03:00'), day: 12 },
      changeG: 110,
      changePct: 3.2,
    });
  });

  it('counts the feeds of the last 24 hours, with a mixed feed counting once', () => {
    // 18:00, the 02:00 mixed session, 09:00 and 13:00 = 4 feeds.
    // Bottles: 90 + 60 + 100 = 250 mL. Breast: 20 + 25 = 45 minutes.
    expect(report().last24h.feeds).toEqual({
      count: 4,
      bottleMl: 250,
      breastMs: 45 * MIN,
      // 18:00 to 02:00 is the longest run: 8 hours.
      longestGapMs: 8 * HOUR,
      lastAt: at('2026-10-21T13:00:00+03:00'),
    });
  });

  it('counts wet and dirty diapers of the last 24 hours, both counting as one of each', () => {
    // both (18:30), wet (03:00), dirty (11:00) = 2 wet, 2 dirty.
    expect(report().last24h).toMatchObject({ wet: 2, dirty: 2 });
  });

  it('gives the latest temperature with its time, and nothing about it', () => {
    expect(report().lastTemperature).toEqual({
      celsius: 36.9,
      at: at('2026-10-21T10:00:00+03:00'),
    });
  });

  it('lists the health notes and the medication in the window, oldest first', () => {
    expect(report().notes).toEqual([
      {
        at: at('2026-10-21T04:00:00+03:00'),
        note: 'Warm after a feed',
        tempC: 37.2,
        tags: [],
      },
      { at: at('2026-10-21T10:00:00+03:00'), note: null, tempC: 36.9, tags: [] },
    ]);
    expect(report().medications).toEqual([
      { at: at('2026-10-21T04:30:00+03:00'), name: 'Vitamin D', dose: '1 drop' },
    ]);
  });

  it('keeps the last 24 hours the same whatever range is asked for', () => {
    expect(report('7d').last24h).toEqual(report('24h').last24h);
  });
});

describe('the ranges', () => {
  it('measures 24h from now, not from midnight', () => {
    const r = report('24h');
    expect(r.from).toBe(NOW - DAY);
    expect(r.window.feeds.count).toBe(4);
    expect(r.days).toHaveLength(1);
  });

  it('measures 3 days from the local midnight two days back', () => {
    const r = report('3d');
    expect(r.from).toBe(at('2026-10-19T00:00:00+03:00'));
    // 19th: 70. 20th: 80 + 90. 21st: 60 + 100 = 400 mL over 6 feeds.
    expect(r.window.feeds).toMatchObject({ count: 6, bottleMl: 400 });
    expect(r.days).toHaveLength(3);
    expect(r.days.map((d) => d.ml)).toEqual([70, 170, 160]);
  });

  it('measures 7 days the same way, with a row per day', () => {
    const r = report('7d');
    expect(r.days).toHaveLength(7);
    expect(r.days.map((d) => d.ml)).toEqual([0, 0, 0, 0, 70, 170, 160]);
    expect(r.days[6]?.daysAgo).toBe(0);
  });

  it('counts sleep within the window, clipped at its start', () => {
    // The 22:00 to 01:00 sleep: only the hour after midnight is in the
    // rolling 24 hours... which starts at 14:00 Tuesday, so all 3 hours are.
    expect(report('24h').window.sleepMs).toBe(3 * HOUR);
    // From the 19th, the same 3 hours are the only sleep logged.
    expect(report('3d').window.sleepMs).toBe(3 * HOUR);
  });
});

describe('the whole object', () => {
  // The figures above are checked one by one; this pins the shape, so a field
  // that appears, disappears or moves shows up as a change to review.
  it('matches the recorded 24h report', () => {
    expect(report('24h')).toMatchSnapshot();
  });

  it('matches the recorded 7d report', () => {
    expect(report('7d')).toMatchSnapshot();
  });
});

describe('what a report leaves out', () => {
  it('ignores deleted entries', () => {
    const deleted = events.map((e) =>
      e.type === 'feed_bottle' && e.occurredAt === at('2026-10-21T13:00:00+03:00')
        ? { ...e, deletedAt: NOW }
        : e,
    );
    expect(report('24h', deleted).last24h.feeds).toMatchObject({
      count: 3,
      bottleMl: 150,
      lastAt: at('2026-10-21T09:00:00+03:00'),
    });
  });

  it('holds up with nothing logged at all', () => {
    const r = buildReport([], BABY, '7d', NOW, TZ);
    expect(r.last24h.feeds).toEqual({
      count: 0,
      bottleMl: 0,
      breastMs: 0,
      longestGapMs: null,
      lastAt: null,
    });
    expect(r.weight.latest).toBe(null);
    expect(r.notes).toEqual([]);
    expect(r.lastTemperature).toBe(null);
    expect(r.days).toHaveLength(7);
  });

  it('says nothing about a baby with no recorded birth weight', () => {
    const r = buildReport(events, { ...BABY, birthWeightG: null }, '24h', NOW, TZ);
    expect(r.weight).toMatchObject({ birthGrams: null, changeG: null, changePct: null });
    expect(r.weight.latest?.grams).toBe(3510);
  });

  it('carries no judgement of any figure', () => {
    // The report is numbers and times. Anything that reads as an opinion
    // would have to be a string; there are only the baby's name, notes and
    // medication names, all typed by a person.
    const strings: string[] = [];
    const walk = (value: unknown): void => {
      if (typeof value === 'string') strings.push(value);
      else if (Array.isArray(value)) value.forEach(walk);
      else if (value && typeof value === 'object') Object.values(value).forEach(walk);
    };
    walk(report('7d'));

    // Every one is a date key, the range, or something a person typed.
    const typedByAPerson = ['Ella', 'Vitamin D', '1 drop', 'Warm after a feed'];
    const rest = strings.filter((s) => !typedByAPerson.includes(s));
    expect(rest.every((s) => s === '7d' || /^\d{4}-\d{2}-\d{2}$/.test(s))).toBe(true);
    expect(strings).toEqual(expect.arrayContaining(typedByAPerson));
  });
});
