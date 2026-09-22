import { render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import { useTranslation } from 'react-i18next';

import i18n, { dateLocale } from '.';

function Title() {
  const { t } = useTranslation();
  return <Text>{t('app.name')}</Text>;
}

describe('i18n', () => {
  it('resolves English keys synchronously on first render', async () => {
    expect(i18n.isInitialized).toBe(true);
    await render(<Title />);
    expect(screen.getByText('Moraki')).toBeOnTheScreen();
  });

  it('rejects unknown keys at compile time', () => {
    // tsc fails this file if the key below ever becomes valid, or if keys stop being typed.
    // @ts-expect-error: 'app.nmae' is not a key in en.json
    expect(i18n.t('app.nmae')).toBe('app.nmae');
  });

  it('formats English dates day first, as read in Cyprus (P1-F12)', () => {
    expect(dateLocale('en')).toBe('en-GB');
    const friday = Date.UTC(2026, 9, 23, 9);
    const format = new Intl.DateTimeFormat(dateLocale('en'), {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      timeZone: 'Europe/Nicosia',
    });
    expect(format.format(friday)).toBe('Friday 23 October');
  });

  it('passes other languages through unchanged', () => {
    expect(dateLocale('el')).toBe('el');
  });
});
