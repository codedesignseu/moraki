import type { Event, EventType, HistoryGroup } from '../activities';
import { selectHistory } from './historySections';

const TZ = 'Europe/Nicosia';
const MIN = 60_000;
const HOUR = 60 * MIN;
const NOW = Date.parse('2026-10-25T10:00:00Z'); // 12:00 local on the 25-hour DST day

let n = 0;
function ev(
  type: EventType,
  occurredAt: number,
  payload: unknown,
  extra: Partial<Event<unknown>> = {},
): Event<unknown> {
  n += 1;
  return {
    id: `e${n}`,
    householdId: 'h',
    babyId: 'b',
    type,
    occurredAt,
    endedAt: null,
    payload,
    groupId: null,
    createdBy: 'u',
    updatedBy: 'u',
    clientCreatedAt: occurredAt,
    deletedAt: null,
    ...extra,
  };
}
const newestFirst = (events: Event<unknown>[]) =>
  [...events].sort((a, b) => b.occurredAt - a.occurredAt);
const history = (events: Event<unknown>[], groups: HistoryGroup[] = [], tz = TZ, now = NOW) =>
  selectHistory(newestFirst(events), now, tz, new Set(groups));

const bottle = (at: number) => ev('feed_bottle', at, { ml: 90, milk: 'formula' });
const diaper = (at: number) => ev('diaper', at, { kind: 'wet' });
const sleep = (at: number) => ev('sleep', at, {}, { endedAt: at + HOUR });
const med = (at: number) => ev('medication', at, { name: 'Vitamin D' });
const weight = (at: number) => ev('weight', at, { grams: 3400, source: 'home' });

describe('selectHistory', () => {
  it('groups newest first into local days with how many days ago each is', () => {
    const events = [
      bottle(NOW - HOUR),
      diaper(NOW - 2 * HOUR),
      bottle(Date.parse('2026-10-24T20:30:00Z')), // 23:30 on the 24th, local
      diaper(Date.parse('2026-10-22T09:00:00Z')),
    ];
    const sections = history(events);
    expect(sections.map((s) => [s.day, s.daysAgo, s.events.length])).toEqual([
      ['2026-10-25', 0, 2],
      ['2026-10-24', 1, 1],
      ['2026-10-22', 3, 1],
    ]);
    expect(sections[0]?.events.map((e) => e.id)).toEqual([events[0]?.id, events[1]?.id]);
  });

  it('uses local midnight, not UTC, including the 25-hour DST day', () => {
    // 00:30 local on the 25th is still the 24th in UTC.
    const justAfterMidnight = bottle(Date.parse('2026-10-24T21:30:00Z'));
    expect(history([justAfterMidnight]).map((s) => s.day)).toEqual(['2026-10-25']);
    expect(history([justAfterMidnight], [], 'UTC').map((s) => s.day)).toEqual(['2026-10-24']);
  });

  it('shows everything when no filter is chosen', () => {
    const events = [
      bottle(NOW - HOUR),
      diaper(NOW - 2 * HOUR),
      sleep(NOW - 3 * HOUR),
      med(NOW - 4 * HOUR),
      weight(NOW - 5 * HOUR),
    ];
    expect(history(events).flatMap((s) => s.events)).toHaveLength(5);
  });

  it.each([
    [['feeds'], ['feed_bottle', 'feed_breast']],
    [['diapers'], ['diaper']],
    [['sleep'], ['sleep']],
    [['health'], ['health', 'medication']],
    [['other'], ['weight']],
    [
      ['feeds', 'diapers'],
      ['feed_bottle', 'feed_breast', 'diaper'],
    ],
  ] as const)('keeps only the chosen groups %j', (groups, types) => {
    const events = [
      bottle(NOW - HOUR),
      ev('feed_breast', NOW - 90 * MIN, { side: 'left' }),
      diaper(NOW - 2 * HOUR),
      sleep(NOW - 3 * HOUR),
      ev('health', NOW - 4 * HOUR, { note: 'x' }),
      med(NOW - 5 * HOUR),
      weight(NOW - 6 * HOUR),
    ];
    const shown = history(events, [...groups]).flatMap((s) => s.events.map((e) => e.type));
    expect(new Set(shown)).toEqual(new Set(types));
  });

  it('drops days with nothing left after filtering', () => {
    const events = [bottle(NOW - HOUR), diaper(Date.parse('2026-10-23T09:00:00Z'))];
    expect(history(events, ['feeds']).map((s) => s.day)).toEqual(['2026-10-25']);
  });

  it('leaves out deleted events', () => {
    const events = [
      bottle(NOW - HOUR),
      ev('diaper', NOW - 2 * HOUR, { kind: 'wet' }, { deletedAt: NOW }),
    ];
    expect(history(events).flatMap((s) => s.events.map((e) => e.type))).toEqual(['feed_bottle']);
  });

  it('returns no sections for no events', () => {
    expect(history([])).toEqual([]);
  });
});
