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
