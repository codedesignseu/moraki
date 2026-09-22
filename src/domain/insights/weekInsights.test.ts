import type { Event, EventType } from '../activities';
import { selectHomeState, DEFAULT_HOME_SETTINGS } from '../home/homeState';
import { selectWeekInsights } from './weekInsights';

// Every expected number below was worked out by hand from the fixture, written
// next to it, never read back from the code. Times are local Nicosia wall
// clock with the offset in force: UTC+3 until clocks go back at 04:00 on
// Sunday 25 October 2026 (to 03:00), UTC+2 after.
const PROCESS_TZ = Intl.DateTimeFormat().resolvedOptions().timeZone;
const TZ = 'Europe/Nicosia';
const MIN = 60_000;
const HOUR = 60 * MIN;
const at = (iso: string) => Date.parse(iso);

const NOW = at('2026-10-28T14:00:00+02:00'); // Wednesday, 14:00

let seq = 0;
function ev<P>(type: EventType, iso: string, payload: P, extra: Partial<Event<P>> = {}): Event<P> {
  seq += 1;
  return {
    id: `e${seq}`,
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
const breast = (iso: string, payload: object, extra = {}) =>
  ev('feed_breast', iso, { side: 'left', ...payload }, extra);
const diaper = (iso: string, kind: 'wet' | 'dirty' | 'both') => ev('diaper', iso, { kind });
const sleep = (from: string, to: string | null) =>
  ev('sleep', from, {}, { endedAt: to === null ? null : at(to) });

const week: Event<unknown>[] = [
  // Wednesday 21, the day before the window: nothing counts, except the part
  // of the sleep that runs past midnight into Thursday 22.
  bottle('2026-10-21T23:30:00+03:00', 120),
  diaper('2026-10-21T23:59:00+03:00', 'wet'),
  sleep('2026-10-21T23:00:00+03:00', '2026-10-22T02:00:00+03:00'), // 2h on Thursday

  // Thursday 22: six bottles. 90+90+100+100+110+110 = 600 mL.
  bottle('2026-10-22T00:10:00+03:00', 90), // first feed in the window
  bottle('2026-10-22T03:30:00+03:00', 90),
  bottle('2026-10-22T07:00:00+03:00', 100),
  bottle('2026-10-22T11:00:00+03:00', 100),
  bottle('2026-10-22T15:00:00+03:00', 110),
  bottle('2026-10-22T19:00:00+03:00', 110),
  diaper('2026-10-22T06:00:00+03:00', 'wet'),
  diaper('2026-10-22T10:00:00+03:00', 'wet'),
  diaper('2026-10-22T14:00:00+03:00', 'dirty'),
  diaper('2026-10-22T18:00:00+03:00', 'both'), // wet 3, dirty 2
  sleep('2026-10-22T13:00:00+03:00', '2026-10-22T15:00:00+03:00'), // +2h = 4h

  // Friday 23: no feeds at all, one wet diaper, no sleep logged.
  diaper('2026-10-23T09:00:00+03:00', 'wet'),

  // Saturday 24, a busy day: 8 feeds (the mixed feed counts once).
  breast('2026-10-24T02:00:00+03:00', { left_s: 600 }), // 10m
  breast(
    '2026-10-24T05:00:00+03:00',
    { side: 'right' },
    { endedAt: at('2026-10-24T05:20:00+03:00') },
  ), // 20m
  bottle('2026-10-24T09:00:00+03:00', 60, { groupId: 'mixed' }),
  breast(
    '2026-10-24T09:00:00+03:00',
    { side: 'both', left_s: 300, right_s: 300 },
    { groupId: 'mixed' },
  ), // 10m
  bottle('2026-10-24T12:00:00+03:00', 150),
  bottle('2026-10-24T15:00:00+03:00', 150),
  bottle('2026-10-24T18:00:00+03:00', 150),
  bottle('2026-10-24T21:00:00+03:00', 150), // 60 + 4 x 150 = 660 mL
  breast('2026-10-24T23:45:00+03:00', { left_s: 900 }), // 15m; 10+20+10+15 = 55m
  diaper('2026-10-24T03:00:00+03:00', 'wet'),
  diaper('2026-10-24T08:00:00+03:00', 'wet'),
  diaper('2026-10-24T13:00:00+03:00', 'wet'),
  diaper('2026-10-24T17:00:00+03:00', 'wet'),
  diaper('2026-10-24T22:00:00+03:00', 'both'), // wet 5, dirty 1
  sleep('2026-10-24T22:00:00+03:00', '2026-10-25T01:30:00+03:00'), // 2h Saturday, 1h30 Sunday

  // Sunday 25, 25 hours long: 03:00 to 04:00 happens twice.
  bottle('2026-10-25T00:30:00+03:00', 70),
  diaper('2026-10-25T03:30:00+03:00', 'wet'), // first 03:30
  bottle('2026-10-25T03:30:00+02:00', 80), // second 03:30
  bottle('2026-10-25T23:30:00+02:00', 90), // last half hour of the day; 70+80+90 = 240 mL
  // 02:00 UTC+3 to 06:00 UTC+2 is 4 hours on the wall clock but 5 hours asleep.
  sleep('2026-10-25T02:00:00+03:00', '2026-10-25T06:00:00+02:00'), // 1h30 + 5h = 6h30

  // Monday 26: two bottles; a third was deleted and doesn't count.
  bottle('2026-10-26T06:00:00+02:00', 120),
  bottle('2026-10-26T09:00:00+02:00', 200, { deletedAt: at('2026-10-26T09:05:00+02:00') }),
  bottle('2026-10-26T12:00:00+02:00', 120), // 240 mL
  diaper('2026-10-26T08:00:00+02:00', 'dirty'),
  // The same nap on two phones, overlapping by an hour: 13:00 to 16:00 is 3h.
  sleep('2026-10-26T13:00:00+02:00', '2026-10-26T15:00:00+02:00'),
  sleep('2026-10-26T14:00:00+02:00', '2026-10-26T16:00:00+02:00'),

  // Tuesday 27, a quiet day: one breast feed logged without a duration.
  breast('2026-10-27T10:00:00+02:00', { side: 'both' }), // a feed, 0 minutes
  diaper('2026-10-27T11:00:00+02:00', 'wet'),

  // Wednesday 28, today until 14:00.
  bottle('2026-10-28T01:00:00+02:00', 100),
  bottle('2026-10-28T05:00:00+02:00', 100), // 200 mL
  breast('2026-10-28T09:10:00+02:00', { side: 'right', right_s: 720 }), // 12m; last feed
  diaper('2026-10-28T08:00:00+02:00', 'both'), // wet 1, dirty 1
  sleep('2026-10-28T13:00:00+02:00', null), // still asleep: 1h so far
];

describe(`[process TZ ${PROCESS_TZ}] selectWeekInsights, hand-checked week`, () => {
  const insights = selectWeekInsights(week, NOW, TZ);

  it('has the 7 local days ending today, oldest first, starting at local midnight', () => {
    expect(insights.days.map((d) => [d.key, d.daysAgo, d.start])).toEqual([
      ['2026-10-22', 6, at('2026-10-22T00:00:00+03:00')],
      ['2026-10-23', 5, at('2026-10-23T00:00:00+03:00')],
      ['2026-10-24', 4, at('2026-10-24T00:00:00+03:00')],
      ['2026-10-25', 3, at('2026-10-25T00:00:00+03:00')],
      ['2026-10-26', 2, at('2026-10-26T00:00:00+02:00')], // 25 hours after Sunday's
      ['2026-10-27', 1, at('2026-10-27T00:00:00+02:00')],
      ['2026-10-28', 0, at('2026-10-28T00:00:00+02:00')],
    ]);
  });

  it.each([
    // key,        feeds, ml,  breast, wet, dirty, sleep
    ['2026-10-22', 6, 600, 0, 3, 2, 4 * HOUR],
    ['2026-10-23', 0, 0, 0, 1, 0, 0],
    ['2026-10-24', 8, 660, 55 * MIN, 5, 1, 2 * HOUR],
    ['2026-10-25', 3, 240, 0, 1, 0, 6.5 * HOUR],
    ['2026-10-26', 2, 240, 0, 0, 1, 3 * HOUR],
    ['2026-10-27', 1, 0, 0, 1, 0, 0],
    ['2026-10-28', 3, 200, 12 * MIN, 1, 1, 1 * HOUR],
  ])(
    '%s: %i feeds, %i mL, %i ms breastfeeding, %i wet, %i dirty, %i ms asleep',
    (key, feeds, ml, breastMs, wet, dirty, sleepMs) => {
      expect(insights.days.find((d) => d.key === key)).toMatchObject({
        feeds,
        ml,
        breastMs,
        wet,
        dirty,
        sleepMs,
      });
    },
  );

  it('totals the week', () => {
    expect(insights.totals).toEqual({
      feeds: 23, // 6+0+8+3+2+1+3
      ml: 1940, // 600+0+660+240+240+0+200
      breastMs: 67 * MIN, // 55+12
      wet: 12, // 3+1+5+1+0+1+1
      dirty: 5, // 2+0+1+0+1+0+1
      sleepMs: 16.5 * HOUR, // 4+0+2+6.5+3+0+1
    });
  });

  it('averages 970/9 mL per bottle: 1940 mL over 18 bottles', () => {
    // Bottles: 6 Thursday, 5 Saturday (the mixed feed's included), 3 Sunday,
    // 2 Monday (the deleted one isn't), 2 today.
    expect(insights.averageBottleMl).toBeCloseTo(970 / 9, 10);
  });

  it('averages 7 hours between feeds: 22 gaps from Thursday 00:10 to Wednesday 09:10', () => {
    // 21 Oct 21:10Z to 28 Oct 07:10Z is 6 days 10 hours = 154 hours; 154 / 22 = 7.
    expect(insights.averageIntervalMs).toBe(7 * HOUR);
  });

  it("matches home's today figures for today", () => {
    const home = selectHomeState(week, NOW, TZ, DEFAULT_HOME_SETTINGS).today;
    const today = insights.days[insights.days.length - 1];
    expect(today).toMatchObject({
      feeds: home.feeds,
      ml: home.ml,
      breastMs: home.breastMs,
      wet: home.wet,
      dirty: home.dirty,
    });
  });
});

describe(`[process TZ ${PROCESS_TZ}] selectWeekInsights, edges`, () => {
  it('with nothing logged: seven empty days and no averages', () => {
    const empty = selectWeekInsights([], NOW, TZ);
    expect(empty.days).toHaveLength(7);
    expect(empty.totals).toEqual({ feeds: 0, ml: 0, breastMs: 0, wet: 0, dirty: 0, sleepMs: 0 });
    expect(empty.averageBottleMl).toBeNull();
    expect(empty.averageIntervalMs).toBeNull();
  });

  it('needs two feeds for an interval and a bottle for an average bottle', () => {
    const one = selectWeekInsights([breast('2026-10-28T09:00:00+02:00', {})], NOW, TZ);
    expect(one.totals.feeds).toBe(1);
    expect(one.averageIntervalMs).toBeNull();
    expect(one.averageBottleMl).toBeNull();
  });

  it('counts a 23 hour day as 23 hours when clocks go forward (29 March 2026)', () => {
    const now = at('2026-03-30T12:00:00+03:00');
    const allDay = sleep('2026-03-28T23:00:00+02:00', '2026-03-30T01:00:00+03:00');
    const day = selectWeekInsights([allDay], now, TZ).days.find((d) => d.key === '2026-03-29');
    expect(day?.sleepMs).toBe(23 * HOUR);
  });

  it('crosses a month end in its day keys', () => {
    const keys = selectWeekInsights([], at('2026-11-02T12:00:00+02:00'), TZ).days.map((d) => d.key);
    expect(keys).toEqual([
      '2026-10-27',
      '2026-10-28',
      '2026-10-29',
      '2026-10-30',
      '2026-10-31',
      '2026-11-01',
      '2026-11-02',
    ]);
  });

  it('puts an entry near midnight on its local day, not its UTC day', () => {
    // 00:30 Wednesday in Nicosia is 22:30 Tuesday UTC.
    const late = bottle('2026-10-28T00:30:00+02:00', 50);
    const days = selectWeekInsights([late], NOW, TZ).days;
    expect(days.find((d) => d.key === '2026-10-28')?.ml).toBe(50);
    expect(days.find((d) => d.key === '2026-10-27')?.ml).toBe(0);
  });
});
