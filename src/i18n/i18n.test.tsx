import { render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import { useTranslation } from 'react-i18next';

import i18n from '.';

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
});
