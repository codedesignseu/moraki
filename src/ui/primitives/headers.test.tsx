import { fireEvent, render, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { Text } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ThemeProvider } from '../theme';
import { palette, size, type } from '../tokens';
import { ScreenHeader, ScreenTitle } from '.';

const schemes = ['light', 'night'] as const;
// A phone with a notch: 47 at the top.
const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};
const wrapper = ({ children }: { children: ReactNode }) => (
  <SafeAreaProvider initialMetrics={metrics}>{children}</SafeAreaProvider>
);

describe('ScreenTitle', () => {
  it('is a 30 Comfortaa header with an optional subtitle and end slot', async () => {
    await render(<ScreenTitle title="Trends" subtitle="Last 7 days" right={<Text>Clear</Text>} />);
    expect(screen.getByRole('header', { name: 'Trends' })).toHaveStyle({
      fontFamily: type.title.fontFamily,
      fontSize: 30,
    });
    expect(screen.getByText('Last 7 days')).toBeOnTheScreen();
    expect(screen.getByText('Clear')).toBeOnTheScreen();
  });

  it('leaves the subtitle out when there is none', async () => {
    await render(<ScreenTitle title="History" testID="title" />);
    expect(screen.getByTestId('title').children).toHaveLength(1);
  });
});

describe('ScreenHeader', () => {
  it.each(schemes)('has a round 48 back button and a 22 title in %s', async (scheme) => {
    const onBack = jest.fn();
    await render(
      <ThemeProvider scheme={scheme}>
        <ScreenHeader title="About Moraki" onBack={onBack} backLabel="Back" />
      </ThemeProvider>,
      { wrapper },
    );
    const back = screen.getByRole('button', { name: 'Back' });
    expect(back).toHaveStyle({
      width: size.circleControl,
      height: size.circleControl,
      backgroundColor: palette[scheme].card,
    });
    expect(screen.getByRole('header', { name: 'About Moraki' })).toHaveStyle({ fontSize: 22 });
    await fireEvent.press(back);
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('can close instead of going back', async () => {
    await render(
      <ScreenHeader
        title="Invite"
        onBack={jest.fn()}
        backLabel="Close"
        kind="close"
        testID="header"
      />,
      { wrapper },
    );
    expect(screen.getByRole('button', { name: 'Close' })).toBeOnTheScreen();
    // Clear of the status bar: the inset and 8.
    expect(screen.getByTestId('header')).toHaveStyle({ paddingTop: 47 + 8 });
  });
});
