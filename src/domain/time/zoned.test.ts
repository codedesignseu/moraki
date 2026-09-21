import {
  dayBucket,
  fromWallClock,
  localDayKey,
  offsetMinutes,
  startOfLocalDay,
  toWallClock,
} from './zoned';

// Every function takes tz explicitly. `npm run test:tz` re-runs this file under
// TZ=Europe/Nicosia, UTC and America/New_York to prove the process timezone
// never leaks in (SDD 6.6).
const NICOSIA = 'Europe/Nicosia';
const NEW_YORK = 'America/New_York';
const UTC = 'UTC';

const HOUR = 3_600_000;
const at = (iso: string) => Date.parse(iso);

describe('toWallClock and fromWallClock', () => {
  it.each([
    [NICOSIA, '2026-07-01T09:15:00Z', { year: 2026, month: 7, day: 1, hour: 12, minute: 15 }],
    [NEW_YORK, '2026-07-01T09:15:00Z', { year: 2026, month: 7, day: 1, hour: 5, minute: 15 }],
    [UTC, '2026-07-01T09:15:00Z', { year: 2026, month: 7, day: 1, hour: 9, minute: 15 }],
    [NICOSIA, '2026-12-31T22:30:00Z', { year: 2027, month: 1, day: 1, hour: 0, minute: 30 }],
  ])('in %s, %s reads as local %o', (tz, iso, wall) => {
    expect(toWallClock(at(iso), tz)).toEqual(wall);
    expect(fromWallClock(wall, tz)).toBe(at(iso));
  });

  it('drops seconds and milliseconds', () => {
    expect(toWallClock(at('2026-07-01T09:15:59.999Z'), UTC)).toEqual({
      year: 2026,
      month: 7,
      day: 1,
      hour: 9,
      minute: 15,
    });
  });

  it('round-trips every minute-aligned instant across the Nicosia change', () => {
    const start = at('2026-10-24T21:00:00Z');
    for (let t = start; t < start + 26 * HOUR; t += 15 * 60_000) {
      const wall = toWallClock(t, NICOSIA);
      const earlier = fromWallClock(wall, NICOSIA, 'earlier');
      const later = fromWallClock(wall, NICOSIA, 'later');
      expect([earlier, later]).toContain(t);
    }
  });
});

describe('Nicosia DST end, 25 October 2026 (04:00 EEST back to 03:00 EET)', () => {
  const firstPass = at('2026-10-25T00:30:00Z'); // 03:30 EEST, UTC+3
  const secondPass = at('2026-10-25T01:30:00Z'); // 03:30 EET, UTC+2
  const repeated = { year: 2026, month: 10, day: 25, hour: 3, minute: 30 };

  it('shows both passes through the repeated hour as the same local time', () => {
    expect(toWallClock(firstPass, NICOSIA)).toEqual(repeated);
    expect(toWallClock(secondPass, NICOSIA)).toEqual(repeated);
    expect(offsetMinutes(firstPass, NICOSIA)).toBe(180);
    expect(offsetMinutes(secondPass, NICOSIA)).toBe(120);
  });

  it('keeps an event logged in the repeated hour an hour apart from its twin', () => {
    // Durations are epoch differences, never wall-clock arithmetic.
    expect(secondPass - firstPass).toBe(HOUR);
  });

  it('resolves a repeated wall time to the first pass by default, second on request', () => {
    expect(fromWallClock(repeated, NICOSIA)).toBe(firstPass);
    expect(fromWallClock(repeated, NICOSIA, 'later')).toBe(secondPass);
  });

  it('has a 25 hour local day', () => {
    const start = startOfLocalDay(at('2026-10-25T12:00:00Z'), NICOSIA);
    const next = startOfLocalDay(at('2026-10-26T12:00:00Z'), NICOSIA);
    expect(start).toBe(at('2026-10-24T21:00:00Z'));
    expect(next).toBe(at('2026-10-25T22:00:00Z'));
    expect(next - start).toBe(25 * HOUR);
  });

  it('buckets both passes of the repeated hour into 25 October', () => {
    const now = at('2026-10-25T21:59:00Z'); // 23:59 EET on the 25th
    expect(dayBucket(firstPass, now, NICOSIA)).toEqual({ key: '2026-10-25', daysAgo: 0 });
    expect(dayBucket(secondPass, now, NICOSIA)).toEqual({ key: '2026-10-25', daysAgo: 0 });
  });

  it('counts the whole 25 hour day as today, not just the last 24 hours', () => {
    const now = at('2026-10-25T21:59:00Z'); // 23:59 local
    const justAfterMidnight = at('2026-10-24T21:00:00Z'); // 00:00 EEST, 24h59m earlier
    expect(now - justAfterMidnight).toBeGreaterThan(24 * HOUR);
    expect(dayBucket(justAfterMidnight, now, NICOSIA).daysAgo).toBe(0);
    expect(dayBucket(justAfterMidnight - 60_000, now, NICOSIA)).toEqual({
      key: '2026-10-24',
      daysAgo: 1,
    });
  });

  it('moves the repeated hour to yesterday once the next local day starts', () => {
    const now = at('2026-10-25T22:00:00Z'); // 00:00 EET on the 26th
    expect(dayBucket(firstPass, now, NICOSIA)).toEqual({ key: '2026-10-25', daysAgo: 1 });
    expect(dayBucket(secondPass, now, NICOSIA)).toEqual({ key: '2026-10-25', daysAgo: 1 });
  });
});

describe('DST gaps', () => {
  it('resolves a skipped Nicosia time (29 March 2026, 03:00 to 04:00) to just after the gap', () => {
    const skipped = { year: 2026, month: 3, day: 29, hour: 3, minute: 30 };
    const instant = fromWallClock(skipped, NICOSIA);
    expect(instant).toBe(at('2026-03-29T01:30:00Z'));
    expect(toWallClock(instant, NICOSIA)).toEqual({ ...skipped, hour: 4 });
  });

  it('has a 23 hour local day in New York on 8 March 2026', () => {
    const start = startOfLocalDay(at('2026-03-08T17:00:00Z'), NEW_YORK);
    const next = startOfLocalDay(at('2026-03-09T17:00:00Z'), NEW_YORK);
    expect(next - start).toBe(23 * HOUR);
  });
});

describe('dayBucket uses local midnight, not UTC midnight', () => {
  it('keeps a New York evening event on the local day although the UTC date differs', () => {
    const event = at('2026-06-09T23:00:00Z'); // 19:00 EDT, 9 June
    const now = at('2026-06-10T03:00:00Z'); // 23:00 EDT, 9 June; UTC already 10 June
    expect(dayBucket(event, now, NEW_YORK)).toEqual({ key: '2026-06-09', daysAgo: 0 });
    expect(dayBucket(event, now, UTC)).toEqual({ key: '2026-06-09', daysAgo: 1 });
  });

  it('puts a Nicosia event after local midnight on the new day while UTC is still on the old one', () => {
    const event = at('2026-07-01T21:30:00Z'); // 00:30 EEST, 2 July
    expect(localDayKey(event, NICOSIA)).toBe('2026-07-02');
    expect(localDayKey(event, UTC)).toBe('2026-07-01');
  });

  it('counts calendar days back across a month boundary', () => {
    const now = at('2026-03-02T10:00:00Z');
    expect(dayBucket(at('2026-02-27T10:00:00Z'), now, UTC)).toEqual({
      key: '2026-02-27',
      daysAgo: 3,
    });
  });

  it('gives a negative daysAgo for a future local day', () => {
    const now = at('2026-07-01T10:00:00Z');
    expect(dayBucket(at('2026-07-02T10:00:00Z'), now, UTC).daysAgo).toBe(-1);
  });
});
