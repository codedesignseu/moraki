import { formatClock } from './formatClock';

describe('formatClock', () => {
  it.each([
    ['2026-07-01T11:05:00Z', 'Europe/Nicosia', '14:05'],
    ['2026-07-01T11:05:00Z', 'America/New_York', '07:05'],
    ['2026-07-01T00:00:00Z', 'UTC', '00:00'],
    // Both passes through Nicosia's repeated hour read the same.
    ['2026-10-25T00:30:00Z', 'Europe/Nicosia', '03:30'],
    ['2026-10-25T01:30:00Z', 'Europe/Nicosia', '03:30'],
  ])('%s in %s is %s', (iso, tz, expected) => {
    expect(formatClock(Date.parse(iso), tz)).toBe(expected);
  });
});
