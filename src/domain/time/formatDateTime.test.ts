import { formatDateTime } from './formatDateTime';

describe('formatDateTime', () => {
  it.each([
    ['2026-10-23T11:05:00Z', 'Europe/Nicosia', 'Fri 23 Oct, 14:05'],
    ['2026-10-23T11:05:00Z', 'America/New_York', 'Fri 23 Oct, 07:05'],
    // Both passes through Nicosia's repeated hour.
    ['2026-10-25T00:30:00Z', 'Europe/Nicosia', 'Sun 25 Oct, 03:30'],
    ['2026-10-25T01:30:00Z', 'Europe/Nicosia', 'Sun 25 Oct, 03:30'],
  ])('%s in %s is %s', (iso, tz, expected) => {
    expect(formatDateTime(Date.parse(iso), tz, 'en-GB')).toBe(expected);
  });
});
