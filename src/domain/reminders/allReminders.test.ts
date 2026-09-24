import type { Event, EventType, Settings } from '../activities';
import { computeAllReminders } from './allReminders';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const TZ = 'Europe/Nicosia';
const NOW = Date.UTC(2026, 9, 28, 12, 0);
const ON: Settings = { enabled: true, intervalMin: 180, secondReminderMin: null };

let n = 0;
function ev<P>(type: EventType, occurredAt: number, payload: P, deletedAt: number | null = null) {
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
    deletedAt,
  } satisfies Event<P>;
}
const appointment = (at: number, title = 'Six week check', deleted: number | null = null) =>
  ev('appointment', at, { title }, deleted);
const feed = (at: number) => ev('feed_bottle', at, { ml: 90, milk: 'formula' });

describe('everything the phone should be holding', () => {
  it('has nothing at all when reminders are off', () => {
    const off = { ...ON, enabled: false };
    expect(computeAllReminders([feed(NOW), appointment(NOW + 3 * DAY)], off, NOW, TZ)).toEqual([]);
  });

  it('puts a day before and an hour before each appointment', () => {
    const at = NOW + 3 * DAY;
    const out = computeAllReminders([appointment(at)], ON, NOW, TZ);

    expect(out.map((r) => [r.at - at, r.bodyKey])).toEqual([
      [-DAY, 'reminders.appointment.dayBefore'],
      [-HOUR, 'reminders.appointment.hourBefore'],
    ]);
    expect(out.every((r) => r.category === 'appointment')).toBe(true);
  });

  it('carries the appointment’s own title, and nothing about the baby', () => {
    const out = computeAllReminders([appointment(NOW + 2 * DAY, 'Dr Andreou, 10:30')], ON, NOW, TZ);
    expect(out[0]?.values).toEqual({ title: 'Dr Andreou, 10:30' });
  });

  it('leaves out a reminder whose moment has already passed', () => {
    // In 90 minutes: the day-before moment is long gone, the hour-before one
    // is still ahead.
    const out = computeAllReminders([appointment(NOW + 90 * 60_000)], ON, NOW, TZ);
    expect(out.map((r) => r.bodyKey)).toEqual(['reminders.appointment.hourBefore']);
  });

  it('has nothing for an appointment that has been and gone', () => {
    expect(computeAllReminders([appointment(NOW - DAY)], ON, NOW, TZ)).toEqual([]);
  });

  it('forgets a cancelled appointment', () => {
    expect(computeAllReminders([appointment(NOW + 3 * DAY, 'Gone', NOW)], ON, NOW, TZ)).toEqual([]);
  });

  it('keeps one id per appointment and reminder, so two never collide', () => {
    const out = computeAllReminders(
      [appointment(NOW + 2 * DAY), appointment(NOW + 5 * DAY)],
      ON,
      NOW,
      TZ,
    );
    expect(new Set(out.map((r) => r.id)).size).toBe(4);
  });

  it('gathers the feed reminder and the appointments into one list, soonest first', () => {
    const out = computeAllReminders(
      [feed(NOW - HOUR), appointment(NOW + 2 * DAY), appointment(NOW + 25 * HOUR)],
      ON,
      NOW,
      TZ,
    );

    // Five: the feed, and a pair for each appointment. Soonest first, which
    // is the 25 hour appointment's day-before, an hour from now.
    expect(out.map((r) => r.at - NOW)).toEqual([HOUR, 2 * HOUR, 24 * HOUR, 24 * HOUR, 47 * HOUR]);
    expect(out.map((r) => r.category)).toEqual([
      'appointment',
      'feed',
      'appointment',
      'appointment',
      'appointment',
    ]);
  });

  it("never hands one activity another's entries", () => {
    // A diaper dated in the future (another phone's clock ran fast) must not
    // reach the appointment module, which would read a title off a payload
    // that has none and remind about nothing.
    const skewed = ev('diaper', NOW + 3 * DAY, { kind: 'wet' });
    const out = computeAllReminders([skewed, appointment(NOW + 2 * DAY)], ON, NOW, TZ);

    expect(out.every((r) => r.id.startsWith('appointment:e'))).toBe(true);
    expect(out.every((r) => typeof r.values?.title === 'string')).toBe(true);
    expect(out).toHaveLength(2);
  });

  it('asks each activity only about its own entries', () => {
    // A feed must never reach the appointment module, which would read a
    // title off a payload that has none.
    const out = computeAllReminders([feed(NOW - HOUR), appointment(NOW + 2 * DAY)], ON, NOW, TZ);
    expect(out.filter((r) => r.category === 'appointment').every((r) => r.values?.title)).toBe(
      true,
    );
  });
});
