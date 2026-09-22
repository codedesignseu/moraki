import type { Event, EventType } from '../activities';
import { selectHomeState, type HomeSettings } from './homeState';

const TZ = 'Europe/Nicosia';
const MIN = 60_000;
const HOUR = 60 * MIN;
const NOW = Date.parse('2026-10-25T10:00:00Z'); // 12:00 local, the day clocks go back
const settings: HomeSettings = { reminderIntervalMin: 180, secondReminderMin: 30 };

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
const bottle = (at: number, ml = 90, extra = {}) =>
  ev('feed_bottle', at, { ml, milk: 'formula' }, extra);
const breast = (at: number, side: 'left' | 'right' | 'both', extra = {}) =>
  ev('feed_breast', at, { side }, { endedAt: at + 15 * MIN, ...extra });
const home = (events: Event<unknown>[], now = NOW) => selectHomeState(events, now, TZ, settings);

describe('selectHomeState', () => {
  it('no feeds: nothing to time or remind about', () => {
    const state = home([ev('diaper', NOW - HOUR, { kind: 'wet' })]);
    expect(state).toMatchObject({
      lastFeed: null,
      sinceLastFeedMs: null,
      nextSide: null,
      reminderAt: null,
      secondReminderAt: null,
      today: { feeds: 0, ml: 0, wet: 1, dirty: 0, sleepMs24h: 0 },
      activeSleep: null,
    });
  });

  it('one feed: timer, reminders and today count follow it', () => {
    const feed = bottle(NOW - 2 * HOUR, 120);
    const state = home([feed]);
    expect(state.lastFeed).toBe(feed);
    expect(state.sinceLastFeedMs).toBe(2 * HOUR);
    expect(state.reminderAt).toBe(feed.occurredAt + 3 * HOUR);
    expect(state.secondReminderAt).toBe(feed.occurredAt + 3 * HOUR + 30 * MIN);
    expect(state.today).toMatchObject({ feeds: 1, ml: 120 });
  });

  it('breast then bottle: last feed is the bottle, next side still comes from the breast feed', () => {
    const left = breast(NOW - 4 * HOUR, 'left');
    const later = bottle(NOW - HOUR, 60);
    const state = home([later, left]);
    expect(state.lastFeed).toBe(later);
    expect(state.nextSide).toBe('right');
    expect(state.today).toMatchObject({ feeds: 2, ml: 60 });
  });

  it('deleted last feed: falls back to the feed before it everywhere', () => {
    const earlier = bottle(NOW - 3 * HOUR, 90);
    const deleted = bottle(NOW - HOUR, 150, { deletedAt: NOW - 30 * MIN });
    const state = home([earlier, deleted]);
    expect(state.lastFeed).toBe(earlier);
    expect(state.sinceLastFeedMs).toBe(3 * HOUR);
    expect(state.reminderAt).toBe(earlier.occurredAt + 3 * HOUR);
    expect(state.today).toMatchObject({ feeds: 1, ml: 90 });
    expect(state.lastEntry?.at).toBe(earlier.occurredAt);
  });

  it('active sleep: the running sleep is returned and counts up to now', () => {
    const done = ev('sleep', NOW - 5 * HOUR, {}, { endedAt: NOW - 4 * HOUR });
    const running = ev('sleep', NOW - 40 * MIN, { place: 'crib' });
    const state = home([done, running]);
    expect(state.activeSleep).toBe(running);
    expect(state.today.sleepMs24h).toBe(HOUR + 40 * MIN);
  });

  it('no active sleep once the running one is stopped or deleted', () => {
    expect(home([ev('sleep', NOW - HOUR, {}, { endedAt: NOW - 10 * MIN })]).activeSleep).toBeNull();
    expect(home([ev('sleep', NOW - HOUR, {}, { deletedAt: NOW })]).activeSleep).toBeNull();
  });

  it('counts a bottle plus breast feed sharing a group once', () => {
    const state = home([
      bottle(NOW - HOUR, 60, { groupId: 'g1' }),
      breast(NOW - HOUR, 'left', { groupId: 'g1' }),
    ]);
    expect(state.today).toMatchObject({ feeds: 1, ml: 60 });
  });

  it('keeps a combined feed as one feed with separate bottle mL and breastfeeding totals', () => {
    const state = home([
      bottle(NOW - HOUR, 60, { groupId: 'g1' }),
      ev(
        'feed_breast',
        NOW - HOUR,
        { side: 'left' },
        { groupId: 'g1', endedAt: NOW - HOUR + 12 * MIN },
      ),
    ]);
    expect(state.today).toMatchObject({ feeds: 1, ml: 60, breastMs: 12 * MIN });
  });

  it('adds breastfeeding time across feeds without mixing it into mL', () => {
    const state = home([
      ev('feed_breast', NOW - 3 * HOUR, { side: 'left' }, { endedAt: NOW - 3 * HOUR + 10 * MIN }),
      // Per-side seconds win over start and end: pauses aren't feeding time.
      ev(
        'feed_breast',
        NOW - 2 * HOUR,
        { side: 'both', left_s: 300, right_s: 420 },
        { endedAt: NOW - HOUR },
      ),
      bottle(NOW - HOUR, 90),
    ]);
    expect(state.today).toMatchObject({ feeds: 3, ml: 90, breastMs: 10 * MIN + 12 * MIN });
  });

  it('counts a breast feed with no duration recorded as 0 breastfeeding time, not a guess', () => {
    const state = home([ev('feed_breast', NOW - HOUR, { side: 'right' })]);
    expect(state.today).toMatchObject({ feeds: 1, ml: 0, breastMs: 0 });
  });

  it('today starts at local midnight, not 24 hours ago or UTC midnight', () => {
    // Local midnight on 25 Oct is 21:00Z on the 24th (EEST); this is a 25 hour day.
    const justAfterMidnight = bottle(Date.parse('2026-10-24T21:00:00Z'), 30);
    const justBefore = bottle(Date.parse('2026-10-24T20:59:00Z'), 40);
    const lateNow = Date.parse('2026-10-25T21:59:00Z'); // 23:59 local
    expect(home([justAfterMidnight, justBefore], lateNow).today).toMatchObject({
      feeds: 1,
      ml: 30,
    });
  });

  it('counts time shared by two overlapping sleeps once (P1-20)', () => {
    // 07:00 to 08:30 and 08:00 to 09:00 overlap by 30 minutes: 2h, not 2h 30m.
    const a = ev('sleep', NOW - 3 * HOUR, {}, { endedAt: NOW - 90 * MIN });
    const b = ev('sleep', NOW - 2 * HOUR, {}, { endedAt: NOW - HOUR });
    expect(home([a, b]).today.sleepMs24h).toBe(2 * HOUR);
  });

  it('adds nothing for a sleep entirely inside another, e.g. logged on two phones', () => {
    const long = ev('sleep', NOW - 4 * HOUR, {}, { endedAt: NOW - HOUR });
    const inside = ev('sleep', NOW - 3 * HOUR, {}, { endedAt: NOW - 2 * HOUR });
    expect(home([long, inside]).today.sleepMs24h).toBe(3 * HOUR);
  });

  it('does not double count a past sleep entered over a running one', () => {
    const running = ev('sleep', NOW - HOUR, {});
    const pastOverlapping = ev('sleep', NOW - 90 * MIN, {}, { endedAt: NOW - 30 * MIN });
    expect(home([running, pastOverlapping]).today.sleepMs24h).toBe(90 * MIN);
  });

  it('sleep over the last 24 hours clips a sleep that started before the window', () => {
    const long = ev('sleep', NOW - 26 * HOUR, {}, { endedAt: NOW - 22 * HOUR });
    expect(home([long]).today.sleepMs24h).toBe(2 * HOUR);
  });

  it.each([
    ['left', 'right'],
    ['right', 'left'],
    ['both', null],
  ] as const)('next side after %s is %s', (side, next) => {
    expect(home([breast(NOW - HOUR, side)]).nextSide).toBe(next);
  });

  it('suggests no side when the last breast feed is over 24 hours old', () => {
    expect(home([breast(NOW - 25 * HOUR, 'left')]).nextSide).toBeNull();
  });

  it('counts wet and dirty, with both counting as each', () => {
    const state = home([
      ev('diaper', NOW - 3 * HOUR, { kind: 'wet' }),
      ev('diaper', NOW - 2 * HOUR, { kind: 'dirty' }),
      ev('diaper', NOW - HOUR, { kind: 'both' }),
    ]);
    expect(state.today).toMatchObject({ wet: 2, dirty: 2 });
  });

  it('has no second reminder when the household has none', () => {
    const state = selectHomeState([bottle(NOW - HOUR)], NOW, TZ, {
      reminderIntervalMin: 150,
      secondReminderMin: null,
    });
    expect(state.reminderAt).toBe(NOW - HOUR + 150 * MIN);
    expect(state.secondReminderAt).toBeNull();
  });

  it('last entry is the most recently logged, with its author', () => {
    const backfilled = bottle(NOW - 5 * HOUR, 90, {
      clientCreatedAt: NOW - 5 * MIN,
      createdBy: 'andreas',
    });
    const earlierLogged = ev(
      'diaper',
      NOW - HOUR,
      { kind: 'wet' },
      { clientCreatedAt: NOW - HOUR },
    );
    expect(home([earlierLogged, backfilled]).lastEntry).toEqual({
      type: 'feed_bottle',
      by: 'andreas',
      at: backfilled.occurredAt,
    });
  });
});
