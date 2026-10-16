import type { Event, EventType } from '../activities';
import { selectHomeTiles } from './homeTiles';

const TZ = 'Europe/Nicosia';
const MIN = 60_000;
const HOUR = 60 * MIN;
const NOW = Date.parse('2026-07-01T09:00:00Z'); // 12:00 local

let seq = 0;
function ev<P>(
  type: EventType,
  occurredAt: number,
  payload: P,
  extra: Partial<Event<P>> = {},
): Event<P> {
  seq += 1;
  return {
    id: `e${seq}`,
    householdId: 'h',
    babyId: 'b',
    type,
    occurredAt,
    endedAt: null,
    payload,
    groupId: null,
    createdBy: 'me',
    updatedBy: 'me',
    clientCreatedAt: occurredAt,
    deletedAt: null,
    ...extra,
  };
}

const tiles = (events: Event<unknown>[], now = NOW) => selectHomeTiles(events, now, TZ);

describe('selectHomeTiles', () => {
  it('says nothing yet for every tile before anything is logged', () => {
    expect(tiles([])).toEqual({
      feed: { kind: 'none' },
      sleep: { kind: 'none' },
      diaper: { kind: 'none' },
      pump: { kind: 'none' },
    });
  });

  it('gives each tile the time of its latest entry, by when it happened', () => {
    const result = tiles([
      ev('feed_bottle', NOW - 2 * HOUR, { ml: 90, milk: 'formula' }),
      // Logged later but happened earlier: the bottle above is still the latest.
      ev('feed_bottle', NOW - 5 * HOUR, { ml: 60, milk: 'formula' }, { clientCreatedAt: NOW }),
      ev('diaper', NOW - HOUR, { kind: 'wet' }),
    ]);
    expect(result.feed).toEqual({ kind: 'last', at: NOW - 2 * HOUR, daysAgo: 0 });
    expect(result.diaper).toEqual({ kind: 'last', at: NOW - HOUR, daysAgo: 0 });
    expect(result.pump).toEqual({ kind: 'none' });
  });

  it('puts bottle and breast feeds on the one feed tile', () => {
    const result = tiles([
      ev('feed_bottle', NOW - 3 * HOUR, { ml: 90, milk: 'formula' }),
      ev('feed_breast', NOW - HOUR, { side: 'left' }, { endedAt: NOW - 45 * MIN }),
    ]);
    expect(result.feed).toEqual({ kind: 'last', at: NOW - HOUR, daysAgo: 0 });
  });

  it('counts the day in local time, so a late entry yesterday reads as yesterday', () => {
    const lateYesterday = Date.parse('2026-06-30T19:30:00Z'); // 22:30 local
    expect(tiles([ev('pump', lateYesterday, { ml: 80, dest: 'fridge' })]).pump).toEqual({
      kind: 'last',
      at: lateYesterday,
      daysAgo: 1,
    });
  });

  it('shows a running sleep as running', () => {
    expect(tiles([ev('sleep', NOW - 30 * MIN, {})]).sleep).toEqual({ kind: 'running' });
  });

  it('counts the time awake from when the latest sleep ended', () => {
    const result = tiles([
      ev('sleep', NOW - 5 * HOUR, {}, { endedAt: NOW - 4 * HOUR }),
      ev('sleep', NOW - 3 * HOUR, {}, { endedAt: NOW - 65 * MIN }),
    ]);
    expect(result.sleep).toEqual({ kind: 'awake', sinceMs: 65 * MIN });
  });

  it('reads a sleep that ends after now (clock skew) as just woken', () => {
    const result = tiles([ev('sleep', NOW - HOUR, {}, { endedAt: NOW + MIN })]);
    expect(result.sleep).toEqual({ kind: 'awake', sinceMs: 0 });
  });

  it('leaves out deleted entries and kinds that have no tile', () => {
    const result = tiles([
      ev('feed_bottle', NOW - HOUR, { ml: 90, milk: 'formula' }, { deletedAt: NOW }),
      ev('sleep', NOW - HOUR, {}, { deletedAt: NOW }),
      ev('health', NOW - HOUR, { tags: [] }),
      ev('stock_adjust', NOW - HOUR, { place: 'fridge', deltaMl: -50 }),
    ]);
    expect(result).toEqual({
      feed: { kind: 'none' },
      sleep: { kind: 'none' },
      diaper: { kind: 'none' },
      pump: { kind: 'none' },
    });
  });
});
