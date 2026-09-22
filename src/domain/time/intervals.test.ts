import { coveredMs } from './intervals';

const H = 3_600_000;
const iv = (start: number, end: number) => ({ start: start * H, end: end * H });

describe('coveredMs', () => {
  it.each([
    ['nothing', [], 0],
    ['disjoint intervals add up', [iv(1, 2), iv(3, 5)], 3],
    ['overlapping intervals count shared time once', [iv(1, 3), iv(2, 4)], 3],
    ['an interval inside another adds nothing', [iv(1, 5), iv(2, 3)], 4],
    ['intervals that touch end to start join', [iv(1, 2), iv(2, 3)], 2],
    ['order does not matter', [iv(6, 8), iv(1, 3), iv(2, 4)], 5],
    ['the same interval twice counts once', [iv(1, 2), iv(1, 2)], 1],
  ])('%s', (_name, intervals, hours) => {
    expect(coveredMs(intervals, 0, 24 * H)).toBe(hours * H);
  });

  it('clips intervals to the window before merging', () => {
    // 20:00 the day before to 02:00, and 01:00 to 03:00, in a window from 00:00 to 24:00.
    expect(coveredMs([iv(-4, 2), iv(1, 3)], 0, 24 * H)).toBe(3 * H);
    expect(coveredMs([iv(-4, -1)], 0, 24 * H)).toBe(0);
  });
});
