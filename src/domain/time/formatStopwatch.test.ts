import { formatStopwatch } from './formatStopwatch';

const SEC = 1000;
const MIN = 60 * SEC;
const HOUR = 60 * MIN;

describe('formatStopwatch', () => {
  it('shows hours, minutes and seconds (G: "1:05:12")', () => {
    expect(formatStopwatch(HOUR + 5 * MIN + 12 * SEC)).toBe('1:05:12');
  });

  it('keeps a zero hour under an hour', () => {
    expect(formatStopwatch(20 * MIN)).toBe('0:20:00');
  });

  it('rounds partial seconds down', () => {
    expect(formatStopwatch(59_999)).toBe('0:00:59');
  });

  it('keeps counting past ten hours', () => {
    expect(formatStopwatch(12 * HOUR + 3 * SEC)).toBe('12:00:03');
  });

  it('reads a negative time (clock skew) as zero', () => {
    expect(formatStopwatch(-5 * SEC)).toBe('0:00:00');
  });
});
