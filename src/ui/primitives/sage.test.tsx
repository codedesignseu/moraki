import type { ReactNode } from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ThemeProvider } from '../theme';
import { palette, radius, size } from '../tokens';
import { ActivityTile, Card, EmptyState, IconButton, ListRow, Logo, StatusPill, TabBar } from '.';

const noop = () => {};
const HIDDEN = { includeHiddenElements: true };
// A phone whose bottom inset is smaller than the bar's 30 gap.
const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};
const wrapper = ({ children }: { children: ReactNode }) => (
  <SafeAreaProvider initialMetrics={metrics}>{children}</SafeAreaProvider>
);

describe('IconButton', () => {
  it('is a labelled button with a full touch target', async () => {
    const onPress = jest.fn();
    await render(<IconButton icon="close" onPress={onPress} accessibilityLabel="Close" />);
    const button = screen.getByRole('button', { name: 'Close' });
    await fireEvent.press(button);
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(size.iconButton + 2 * button.props.hitSlop).toBeGreaterThanOrEqual(size.touchTarget);
  });

  it.each(['light', 'night'] as const)('takes its fill from the %s palette', async (scheme) => {
    await render(
      <ThemeProvider scheme={scheme}>
        <IconButton icon="plus" tone="chip" onPress={noop} accessibilityLabel="Add" />
      </ThemeProvider>,
    );
    expect(screen.getByRole('button')).toHaveStyle({ backgroundColor: palette[scheme].chip });
  });
});

describe('ActivityTile', () => {
  it('is one button named by its action, with the detail as its value', async () => {
    const onPress = jest.fn();
    await render(
      <ActivityTile
        colour="feed"
        icon="feed"
        title="Feed"
        detail="2 h ago"
        onPress={onPress}
        accessibilityLabel="Log a feed"
      />,
    );
    const tile = screen.getByRole('button', { name: 'Log a feed' });
    expect(tile).toHaveAccessibilityValue({ text: '2 h ago' });
    await fireEvent.press(tile);
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(screen.getAllByRole('button')).toHaveLength(1);
  });

  it.each(['light', 'night'] as const)(
    'grows with large text and uses the %s tile colour',
    async (scheme) => {
      await render(
        <ThemeProvider scheme={scheme}>
          <ActivityTile
            colour="sleep"
            icon="sleep"
            title="Sleep"
            onPress={noop}
            accessibilityLabel="Log sleep"
          />
        </ThemeProvider>,
      );
      const tile = screen.getByRole('button');
      expect(tile).toHaveStyle({
        minHeight: size.activityTile,
        borderRadius: radius.tile,
        backgroundColor: palette[scheme].sleep,
      });
      expect(tile).not.toHaveStyle({ height: size.activityTile });
    },
  );
});

describe('ListRow', () => {
  it('is a button with a chevron when it can be pressed', async () => {
    const onPress = jest.fn();
    await render(<ListRow title="Night mode" detail="Auto" icon="sleep" onPress={onPress} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Night mode, Auto' }));
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('list-row-chevron', HIDDEN)).toBeTruthy();
  });

  it('is plain content without onPress, and shows what it is given at the end', async () => {
    await render(<ListRow title="Version" trailing={<Text>1.0</Text>} />);
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByText('1.0')).toBeTruthy();
    expect(screen.queryByTestId('list-row-chevron', HIDDEN)).toBeNull();
  });
});

describe('TabBar', () => {
  it('marks the selected tab and reports presses', async () => {
    const onHistory = jest.fn();
    await render(
      <TabBar
        items={[
          { key: 'home', label: 'Home', icon: 'tab-home', selected: true, onPress: noop },
          {
            key: 'history',
            label: 'History',
            icon: 'tab-history',
            selected: false,
            onPress: onHistory,
          },
        ]}
      />,
      { wrapper },
    );
    expect(screen.getByRole('button', { name: 'Home' })).toBeSelected();
    expect(screen.getByRole('button', { name: 'History' })).not.toBeSelected();
    await fireEvent.press(screen.getByRole('button', { name: 'History' }));
    expect(onHistory).toHaveBeenCalledTimes(1);
  });

  it('gives each tab a 52 round button and floats 30 above the edge', async () => {
    await render(
      <TabBar
        items={[{ key: 'h', label: 'Home', icon: 'tab-home', selected: true, onPress: noop }]}
        testID="bar"
      />,
      { wrapper },
    );
    expect(screen.getByRole('button')).toHaveStyle({
      width: size.navButton,
      height: size.navButton,
    });
    expect(size.navButton).toBeGreaterThanOrEqual(44);
    expect(screen.getByTestId('bar')).toHaveStyle({ bottom: size.navBottom });
  });

  it('keeps above a system bar taller than its gap', async () => {
    const tall = { ...metrics, insets: { ...metrics.insets, bottom: 48 } };
    await render(
      <SafeAreaProvider initialMetrics={tall}>
        <TabBar
          items={[{ key: 'h', label: 'Home', icon: 'tab-home', selected: true, onPress: noop }]}
          testID="bar"
        />
      </SafeAreaProvider>,
    );
    expect(screen.getByTestId('bar')).toHaveStyle({ bottom: 48 });
  });

  it.each(['light', 'night'] as const)(
    'fills the buttons from the %s palette, the active one apart',
    async (scheme) => {
      await render(
        <ThemeProvider scheme={scheme}>
          <TabBar
            items={[
              { key: 'h', label: 'Home', icon: 'tab-home', selected: true, onPress: noop },
              { key: 's', label: 'Settings', icon: 'tab-settings', selected: false, onPress: noop },
            ]}
          />
        </ThemeProvider>,
        { wrapper },
      );
      expect(screen.getByRole('button', { name: 'Home' })).toHaveStyle({
        backgroundColor: palette[scheme].navActive,
      });
      expect(screen.getByRole('button', { name: 'Settings' })).toHaveStyle({
        backgroundColor: palette[scheme].navButton,
      });
    },
  );
});

describe('EmptyState', () => {
  it('shows a heading, a line and its one action', async () => {
    await render(
      <EmptyState
        icon="tab-history"
        colour="sleep"
        title="A quiet day so far"
        body="Entries show up here."
        action={<Text>Log a feed</Text>}
      />,
    );
    expect(screen.getByRole('header', { name: 'A quiet day so far' })).toBeTruthy();
    expect(screen.getByText('Entries show up here.')).toBeTruthy();
    expect(screen.getByText('Log a feed')).toBeTruthy();
  });
});

describe('StatusPill', () => {
  it('shows its label and grows with the text', async () => {
    await render(<StatusPill label="Timer running" live testID="pill" />);
    expect(screen.getByText('Timer running')).toBeTruthy();
    expect(screen.getByTestId('pill')).toHaveStyle({ minHeight: size.pill });
  });
});

describe('Card', () => {
  it.each(['light', 'night'] as const)(
    'is white by default and takes a tile tone in %s',
    async (scheme) => {
      await render(
        <ThemeProvider scheme={scheme}>
          <Card testID="plain">
            <Text>a</Text>
          </Card>
          <Card tone="feed" testID="feed">
            <Text>b</Text>
          </Card>
        </ThemeProvider>,
      );
      expect(screen.getByTestId('plain')).toHaveStyle({ backgroundColor: palette[scheme].card });
      expect(screen.getByTestId('feed')).toHaveStyle({ backgroundColor: palette[scheme].feed });
    },
  );
});

describe('Logo', () => {
  it.each(['light', 'night'] as const)(
    'is a header named Moraki, 28 high and untinted, in %s',
    async (scheme) => {
      await render(
        <ThemeProvider scheme={scheme}>
          <Logo accessibilityLabel="Moraki" testID="logo" />
        </ThemeProvider>,
      );
      const logo = screen.getByRole('header', { name: 'Moraki' });
      expect(logo).toHaveStyle({ height: size.logoHeader });
      expect(logo).not.toHaveStyle({ tintColor: palette[scheme].ink });
      expect(logo.props.style.tintColor).toBeUndefined();
    },
  );

  it('uses the day mark by day and the night mark at night', async () => {
    await render(
      <>
        <ThemeProvider scheme="light">
          <Logo accessibilityLabel="Day" />
        </ThemeProvider>
        <ThemeProvider scheme="night">
          <Logo accessibilityLabel="Night" />
        </ThemeProvider>
      </>,
    );
    const day = screen.getByRole('header', { name: 'Day' }).props.source;
    const night = screen.getByRole('header', { name: 'Night' }).props.source;
    expect(day).not.toEqual(night);
  });
});
