import { formatElapsed } from './formatElapsed';

const SECOND = 1_000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;

describe('formatElapsed', () => {
  it.each([
    [0, '0m'],
    [59 * SECOND, '0m'],
    [59 * MINUTE, '59m'],
    [MINUTE, '1m'],
    [42 * MINUTE, '42m'],
    [59 * MINUTE + 59 * SECOND, '59m'],
    [HOUR, '1h 0m'],
    [2 * HOUR + 18 * MINUTE, '2h 18m'],
    [2 * HOUR + 18 * MINUTE + 59 * SECOND, '2h 18m'],
    [26 * HOUR + 5 * MINUTE, '26h 5m'],
  ])('formats %i ms as %s', (elapsedMs, expected) => {
    expect(formatElapsed(elapsedMs)).toBe(expected);
  });

  it('never shows seconds', () => {
    expect(formatElapsed(3 * HOUR + 7 * MINUTE + 45 * SECOND)).not.toMatch(/s/);
  });

  it('shows 0m for negative elapsed time from clock skew', () => {
    expect(formatElapsed(-5 * MINUTE)).toBe('0m');
  });
});
