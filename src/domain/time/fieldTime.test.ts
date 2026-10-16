import { fieldTime } from './fieldTime';

const NICOSIA = 'Europe/Nicosia';
const MIN = 60_000;
// 22:40 in Nicosia (UTC+3 in summer).
const NOW = Date.parse('2026-07-01T19:40:00Z');

describe('fieldTime', () => {
  it('reads a moment this minute as today and now', () => {
    expect(fieldTime(NOW, NOW, NICOSIA, 'en-GB')).toEqual({
      day: 'today',
      clock: '22:40',
      now: true,
    });
    expect(fieldTime(NOW - 30_000, NOW, NICOSIA, 'en-GB')).toMatchObject({ now: true });
  });

  it('reads an earlier time today without "now"', () => {
    expect(fieldTime(NOW - 50 * MIN, NOW, NICOSIA, 'en-GB')).toEqual({
      day: 'today',
      clock: '21:50',
      now: false,
    });
  });

  it('uses the local calendar day, not the UTC one', () => {
    // 00:10 local is 21:10 UTC the day before, and still today here.
    const justAfterMidnight = Date.parse('2026-07-01T21:10:00Z');
    const later = Date.parse('2026-07-01T22:00:00Z');
    expect(fieldTime(justAfterMidnight, later, NICOSIA, 'en-GB')).toMatchObject({
      day: 'today',
      clock: '00:10',
    });
  });

  it('keeps the full date for any other day', () => {
    const yesterday = NOW - 24 * 60 * MIN;
    expect(fieldTime(yesterday, NOW, NICOSIA, 'en-GB')).toEqual({
      day: 'other',
      text: 'Tue 30 Jun, 22:40',
    });
  });
});
