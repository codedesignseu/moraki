import i18n from '.';
import { formatDuration } from './duration';

describe('formatDuration', () => {
  afterEach(async () => {
    await i18n.changeLanguage('en');
  });

  it('reads hours and minutes in English (G: "2 h 15 min")', () => {
    expect(formatDuration(i18n.t, { hours: 2, minutes: 15 })).toBe('2 h 15 min');
    expect(formatDuration(i18n.t, { hours: 2, minutes: 0 })).toBe('2 h 0 min');
  });

  it('reads minutes alone under an hour', () => {
    expect(formatDuration(i18n.t, { hours: 0, minutes: 42 })).toBe('42 min');
    expect(formatDuration(i18n.t, { hours: 0, minutes: 7 }, 'short')).toBe('7 min');
  });

  it('pads the minutes in the short form (G: "Awake 1 h 05")', () => {
    expect(formatDuration(i18n.t, { hours: 1, minutes: 5 }, 'short')).toBe('1 h 05');
  });

  it('uses the Greek units in Greek (G: "2 ώ 15 λ")', async () => {
    await i18n.changeLanguage('el');
    expect(formatDuration(i18n.t, { hours: 2, minutes: 15 })).toBe('2 ώ 15 λ');
    expect(formatDuration(i18n.t, { hours: 1, minutes: 5 }, 'short')).toBe('1 ώ 05');
    expect(formatDuration(i18n.t, { hours: 0, minutes: 42 })).toBe('42 λ');
  });
});
