import { milkAge } from './milkAge';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const NOW = Date.UTC(2026, 9, 28, 12, 0);

describe('how old the milk is', () => {
  it('counts whole hours on the first day', () => {
    expect(milkAge(NOW, NOW)).toEqual({ scale: 'hours', value: 0 });
    expect(milkAge(NOW - 90 * 60_000, NOW)).toEqual({ scale: 'hours', value: 1 });
    expect(milkAge(NOW - 23 * HOUR, NOW)).toEqual({ scale: 'hours', value: 23 });
  });

  it('switches to whole days at the day mark', () => {
    expect(milkAge(NOW - DAY, NOW)).toEqual({ scale: 'days', value: 1 });
    expect(milkAge(NOW - (3 * DAY + 20 * HOUR), NOW)).toEqual({ scale: 'days', value: 3 });
  });

  it('reads as nothing when a phone’s clock puts the milk in the future', () => {
    expect(milkAge(NOW + 5 * HOUR, NOW)).toEqual({ scale: 'hours', value: 0 });
  });
});
