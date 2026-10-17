import { durationParts } from './durationParts';

const MIN = 60_000;
const HOUR = 60 * MIN;

describe('durationParts', () => {
  it('splits a duration into whole hours and the minutes left', () => {
    expect(durationParts(2 * HOUR + 15 * MIN)).toEqual({ hours: 2, minutes: 15 });
  });

  it('has no hours under an hour', () => {
    expect(durationParts(42 * MIN)).toEqual({ hours: 0, minutes: 42 });
  });

  it('rounds partial minutes down and never shows seconds', () => {
    expect(durationParts(5 * MIN + 59_999)).toEqual({ hours: 0, minutes: 5 });
  });

  it('keeps an exact hour as zero minutes', () => {
    expect(durationParts(HOUR)).toEqual({ hours: 1, minutes: 0 });
  });

  it('reads a negative duration (clock skew) as zero', () => {
    expect(durationParts(-3 * MIN)).toEqual({ hours: 0, minutes: 0 });
  });

  it('keeps counting hours past a day', () => {
    expect(durationParts(26 * HOUR + MIN)).toEqual({ hours: 26, minutes: 1 });
  });
});
