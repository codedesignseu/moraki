import { isNight, nextNightChange, nightScheme } from './night';

// Every function takes tz explicitly; `npm run test:tz` re-runs this under
// three process timezones to prove the device timezone never leaks in.
const PROCESS_TZ = Intl.DateTimeFormat().resolvedOptions().timeZone;

const NICOSIA = 'Europe/Nicosia';
const NEW_YORK = 'America/New_York';
const KOLKATA = 'Asia/Kolkata';

const MS = 1;
const HOUR = 3_600_000;
const at = (iso: string) => Date.parse(iso);

describe(`[process TZ ${PROCESS_TZ}] isNight`, () => {
  it.each([
    ['20:59:59.999 local', '2026-07-01T17:59:59.999Z', false],
    ['21:00 local', '2026-07-01T18:00:00Z', true],
    ['midnight local', '2026-07-01T21:00:00Z', true],
    ['05:59:59.999 local', '2026-07-02T02:59:59.999Z', true],
    ['06:00 local', '2026-07-02T03:00:00Z', false],
    ['noon local', '2026-07-02T09:00:00Z', false],
  ])('in Nicosia summer (UTC+3), %s is night: %s', (_label, iso, expected) => {
    expect(isNight(at(iso), NICOSIA)).toBe(expected);
  });

  it('reads the hour in the given timezone, including half-hour offsets', () => {
    // 15:30Z is 21:00 in Kolkata (UTC+5:30), 18:30 in Nicosia, 11:30 in New York.
    expect(isNight(at('2026-07-01T15:30:00Z'), KOLKATA)).toBe(true);
    expect(isNight(at('2026-07-01T15:29:00Z'), KOLKATA)).toBe(false);
    expect(isNight(at('2026-07-01T15:30:00Z'), NICOSIA)).toBe(false);
    expect(isNight(at('2026-07-01T15:30:00Z'), NEW_YORK)).toBe(false);
  });
});

describe(`[process TZ ${PROCESS_TZ}] nightScheme`, () => {
  const noon = at('2026-07-01T09:00:00Z');
  const midnight = at('2026-07-01T21:00:00Z');

  it('follows the clock in auto', () => {
    expect(nightScheme('auto', noon, NICOSIA)).toBe('light');
    expect(nightScheme('auto', midnight, NICOSIA)).toBe('night');
  });

  it('ignores the clock when forced on or off', () => {
    expect(nightScheme('on', noon, NICOSIA)).toBe('night');
    expect(nightScheme('on', midnight, NICOSIA)).toBe('night');
    expect(nightScheme('off', noon, NICOSIA)).toBe('light');
    expect(nightScheme('off', midnight, NICOSIA)).toBe('light');
  });
});

describe(`[process TZ ${PROCESS_TZ}] nextNightChange`, () => {
  it.each([
    // [from, expected, why]
    ['2026-07-01T09:00:00Z', '2026-07-01T18:00:00Z', 'daytime: 21:00 today'],
    ['2026-07-01T17:59:59.999Z', '2026-07-01T18:00:00Z', 'a millisecond before 21:00'],
    ['2026-07-01T18:00:00Z', '2026-07-02T03:00:00Z', 'at 21:00: 06:00 tomorrow'],
    ['2026-07-01T22:30:00Z', '2026-07-02T03:00:00Z', 'after midnight: 06:00 today'],
    ['2026-07-02T03:00:00Z', '2026-07-02T18:00:00Z', 'at 06:00: 21:00 today'],
    ['2026-07-31T19:00:00Z', '2026-08-01T03:00:00Z', 'across a month end'],
    ['2026-12-31T19:00:00Z', '2027-01-01T04:00:00Z', 'across a year end (winter, UTC+2)'],
  ])('in Nicosia, from %s is %s (%s)', (from, expected) => {
    expect(nextNightChange(at(from), NICOSIA)).toBe(at(expected));
  });

  it('is always after now, and flips isNight exactly there', () => {
    for (const from of ['2026-07-01T09:00:00Z', '2026-07-01T18:00:00Z', '2026-07-01T23:00:00Z']) {
      const now = at(from);
      const change = nextNightChange(now, NICOSIA);
      expect(change).toBeGreaterThan(now);
      expect(isNight(change - MS, NICOSIA)).toBe(isNight(now, NICOSIA));
      expect(isNight(change, NICOSIA)).toBe(!isNight(now, NICOSIA));
    }
  });

  // EU clocks change at 01:00 UTC, 03:00 or 04:00 in Nicosia: inside the night.
  it('makes the night 10 hours long when Nicosia clocks go back (25 October 2026)', () => {
    const start = at('2026-10-24T18:00:00Z'); // 21:00 UTC+3
    const end = nextNightChange(start, NICOSIA);
    expect(end).toBe(at('2026-10-25T04:00:00Z')); // 06:00 UTC+2
    expect(end - start).toBe(10 * HOUR);
    expect(nextNightChange(end, NICOSIA)).toBe(at('2026-10-25T19:00:00Z')); // 21:00 UTC+2
  });

  it('makes the night 8 hours long when Nicosia clocks go forward (29 March 2026)', () => {
    const start = at('2026-03-28T19:00:00Z'); // 21:00 UTC+2
    const end = nextNightChange(start, NICOSIA);
    expect(end).toBe(at('2026-03-29T03:00:00Z')); // 06:00 UTC+3
    expect(end - start).toBe(8 * HOUR);
  });

  it('finds the change from inside the repeated hour when clocks go back', () => {
    // 03:30 happens twice in Nicosia on 25 October; both are night until 06:00 UTC+2.
    expect(nextNightChange(at('2026-10-25T00:30:00Z'), NICOSIA)).toBe(at('2026-10-25T04:00:00Z'));
    expect(nextNightChange(at('2026-10-25T01:30:00Z'), NICOSIA)).toBe(at('2026-10-25T04:00:00Z'));
  });

  it('handles the New York change on 1 November 2026', () => {
    const start = at('2026-11-01T01:00:00Z'); // 21:00 EDT on 31 October
    expect(nextNightChange(start, NEW_YORK)).toBe(at('2026-11-01T11:00:00Z')); // 06:00 EST
  });

  it('uses local hours for a half-hour offset', () => {
    expect(nextNightChange(at('2026-07-01T09:00:00Z'), KOLKATA)).toBe(at('2026-07-01T15:30:00Z'));
  });
});
