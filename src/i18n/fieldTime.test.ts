import i18n from '.';
import { formatFieldTime } from './fieldTime';

describe('formatFieldTime', () => {
  afterEach(async () => {
    await i18n.changeLanguage('en');
  });

  it('reads today, and now when it is (G: "Today, 22:40 · now")', () => {
    expect(formatFieldTime(i18n.t, { day: 'today', clock: '22:40', now: true })).toBe(
      'Today, 22:40 · now',
    );
    expect(formatFieldTime(i18n.t, { day: 'today', clock: '21:50', now: false })).toBe(
      'Today, 21:50',
    );
  });

  it('passes another day through as it is', () => {
    expect(formatFieldTime(i18n.t, { day: 'other', text: 'Tue 30 Jun, 22:40' })).toBe(
      'Tue 30 Jun, 22:40',
    );
  });

  it('reads it in Greek', async () => {
    await i18n.changeLanguage('el');
    expect(formatFieldTime(i18n.t, { day: 'today', clock: '22:40', now: true })).toBe(
      'Σήμερα, 22:40 · τώρα',
    );
    expect(formatFieldTime(i18n.t, { day: 'today', clock: '21:50', now: false })).toBe(
      'Σήμερα, 21:50',
    );
  });
});
