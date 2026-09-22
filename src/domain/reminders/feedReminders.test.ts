import type { Event, EventType, Settings } from '../activities';
import { computeFeedReminders, feedDueTimes } from './feedReminders';

const TZ = 'Europe/Nicosia';
const MIN = 60_000;
const HOUR = 60 * MIN;
const NOW = Date.parse('2026-07-01T09:00:00Z'); // 12:00 local
const ON: Settings = { enabled: true, intervalMin: 180, secondReminderMin: 30 };

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
const bottle = (at: number, extra = {}) =>
  ev('feed_bottle', at, { ml: 90, milk: 'formula' }, extra);
const reminders = (events: Event<unknown>[], settings = ON, now = NOW) =>
  computeFeedReminders(events, settings, now, TZ);

describe('computeFeedReminders (SDD 6.2)', () => {
  it('schedules nothing before the first feed', () => {
    expect(reminders([ev('diaper', NOW - HOUR, { kind: 'wet' })])).toEqual([]);
  });

  it('schedules "next feed may be due" at last feed + interval, and the second reminder after it', () => {
    const feed = bottle(NOW - HOUR); // 11:00 local
    expect(reminders([feed])).toEqual([
      {
        id: 'feed:first',
        category: 'feed',
        at: feed.occurredAt + 3 * HOUR,
        bodyKey: 'reminders.feed.first',
      },
      {
        id: 'feed:second',
        category: 'feed',
        at: feed.occurredAt + 3 * HOUR + 30 * MIN,
        bodyKey: 'reminders.feed.second',
        values: { time: '11:00' },
      },
    ]);
  });

  it('recalculates on a new feed: both reminders move to the new feed', () => {
    const earlier = bottle(NOW - 2 * HOUR);
    const before = reminders([earlier]);
    const newer = ev('feed_breast', NOW - 10 * MIN, { side: 'left' }, { endedAt: NOW });
    const after = reminders([earlier, newer]);
    expect(after.map((r) => r.at)).toEqual([
      newer.occurredAt + 3 * HOUR,
      newer.occurredAt + 3.5 * HOUR,
    ]);
    expect(after.map((r) => r.at)).not.toEqual(before.map((r) => r.at));
    expect(after[1]?.values).toEqual({ time: '11:50' });
  });

  it('recalculates on an edit of the last feed: moving its time moves the reminders', () => {
    const feed = bottle(NOW - HOUR);
    const edited = { ...feed, occurredAt: feed.occurredAt - 45 * MIN };
    expect(reminders([edited]).map((r) => r.at)).toEqual([
      edited.occurredAt + 3 * HOUR,
      edited.occurredAt + 3.5 * HOUR,
    ]);
  });

  it('recalculates on a delete of the last feed: falls back to the feed before it', () => {
    const previous = bottle(NOW - 2 * HOUR);
    const last = bottle(NOW - 30 * MIN, { deletedAt: NOW });
    expect(reminders([previous, last]).map((r) => r.at)).toEqual([
      previous.occurredAt + 3 * HOUR,
      previous.occurredAt + 3.5 * HOUR,
    ]);
  });

  it('schedules nothing once the only feed is deleted', () => {
    expect(reminders([bottle(NOW - HOUR, { deletedAt: NOW })])).toEqual([]);
  });

  it('omits the second reminder when the household has none', () => {
    const feed = bottle(NOW - HOUR);
    expect(reminders([feed], { ...ON, secondReminderMin: null }).map((r) => r.id)).toEqual([
      'feed:first',
    ]);
  });

  it('keeps only the second reminder once the first time has passed', () => {
    const feed = bottle(NOW - 3 * HOUR - 10 * MIN);
    expect(reminders([feed]).map((r) => r.id)).toEqual(['feed:second']);
  });

  it('schedules nothing once both times have passed', () => {
    expect(reminders([bottle(NOW - 4 * HOUR)])).toEqual([]);
  });

  it('never schedules a reminder for exactly now', () => {
    const feed = bottle(NOW - 3 * HOUR);
    expect(reminders([feed]).map((r) => r.id)).toEqual(['feed:second']);
  });

  it('schedules nothing when reminders are off on this device', () => {
    expect(reminders([bottle(NOW - HOUR)], { ...ON, enabled: false })).toEqual([]);
  });

  it('counts the interval in elapsed time across the Nicosia DST change', () => {
    // 03:30 EEST (first pass of the repeated hour) + 3 hours is 05:30 EET, 3 real hours later.
    const feed = bottle(Date.parse('2026-10-25T00:30:00Z'));
    const [first, second] = reminders([feed], ON, Date.parse('2026-10-25T01:00:00Z'));
    expect(first?.at).toBe(Date.parse('2026-10-25T03:30:00Z'));
    expect(second?.values).toEqual({ time: '03:30' });
  });

  it('puts no amounts or health data in the notification text', () => {
    const feed = ev('feed_bottle', NOW - HOUR, { ml: 120, milk: 'formula' });
    const text = JSON.stringify(reminders([feed]));
    expect(text).not.toMatch(/120|formula|ml/i);
  });
});

describe('feedDueTimes', () => {
  it('ignores non-feed events and uses the latest feed', () => {
    const feed = bottle(NOW - HOUR);
    expect(feedDueTimes([ev('diaper', NOW, { kind: 'wet' }), feed], 150, null)).toEqual({
      lastFeedAt: feed.occurredAt,
      first: feed.occurredAt + 150 * MIN,
      second: null,
    });
  });
});
