import { parseGrams, WEIGHT_G } from './weight';

describe('reading a typed weight', () => {
  it('takes plain grams', () => {
    expect(parseGrams('4120')).toBe(4120);
  });

  it.each([
    ['4 120', 4120],
    ['4,120', 4120],
    ['4.120', 4120],
    ["4'120", 4120],
    ['4 120', 4120],
  ])('takes %s, however the separator is written', (typed, grams) => {
    expect(parseGrams(typed)).toBe(grams);
  });

  it('ignores space either side of it', () => {
    expect(parseGrams('  3400  ')).toBe(3400);
  });

  it('refuses a decimal, so 4.12 kg never reads as 412 g', () => {
    // A separator counts only where three digits follow it.
    expect(parseGrams('4.12')).toBeNull();
    expect(parseGrams('4,1')).toBeNull();
  });

  // Parents think in kilograms; the app stores grams. A weight feeds the
  // regain chart directly, so a kilogram typed into a grams box has to be
  // refused outright — reading 3.6 as either 3600 or 36 would be a wrong
  // number nobody could see was wrong.
  it.each(['3.6', '3,6', '3.60', '3.6 kg', '3.6kg', '3'])(
    'refuses %p, a weight in kilograms, rather than guessing at it',
    (typed) => {
      expect(parseGrams(typed)).toBeNull();
    },
  );

  it('refuses a bare kilogram figure by range as well as by shape', () => {
    // '36' is a well-formed number and still not a weight a baby could have.
    expect(parseGrams('36')).toBeNull();
    expect(parseGrams('4')).toBeNull();
  });

  it.each(['', '  ', 'abc', '12a', '-500', '3 400g', '4..120'])(
    'refuses %p, which is not a number of grams',
    (typed) => {
      expect(parseGrams(typed)).toBeNull();
    },
  );

  it('refuses a weight outside the range rather than clamping it', () => {
    expect(parseGrams(String(WEIGHT_G.min - 1))).toBeNull();
    expect(parseGrams(String(WEIGHT_G.max + 1))).toBeNull();
    expect(parseGrams(String(WEIGHT_G.min))).toBe(WEIGHT_G.min);
    expect(parseGrams(String(WEIGHT_G.max))).toBe(WEIGHT_G.max);
  });
});
