import { render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AA, contrastRatio, ThemeProvider, themes } from '../theme';
import { Notice } from './Notice';

const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

describe('Notice', () => {
  it('shows its text as an alert strip', async () => {
    await render(
      <SafeAreaProvider initialMetrics={metrics}>
        <ThemeProvider scheme="light">
          <Notice text="Web preview" />
        </ThemeProvider>
      </SafeAreaProvider>,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Web preview');
  });

  it.each(['light', 'night'] as const)('meets AA text contrast in %s', (scheme) => {
    const { colors } = themes[scheme];
    expect(contrastRatio(colors.text, colors.accentSubtle)).toBeGreaterThanOrEqual(AA.text);
  });
});
