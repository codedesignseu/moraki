import { fireEvent, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { ThemeProvider } from '../theme';
import { palette, radius, size } from '../tokens';
import { ActivityTile, EmptyState, IconButton, ListRow, StatusPill, TabBar } from '.';

const noop = () => {};
const HIDDEN = { includeHiddenElements: true };

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
    expect(screen.getByText('›', HIDDEN)).toBeTruthy();
  });

  it('is plain content without onPress, and shows what it is given at the end', async () => {
    await render(<ListRow title="Version" trailing={<Text>1.0</Text>} />);
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByText('1.0')).toBeTruthy();
    expect(screen.queryByText('›', HIDDEN)).toBeNull();
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
    );
    expect(screen.getByRole('button', { name: 'Home' })).toBeSelected();
    expect(screen.getByRole('button', { name: 'History' })).not.toBeSelected();
    await fireEvent.press(screen.getByRole('button', { name: 'History' }));
    expect(onHistory).toHaveBeenCalledTimes(1);
  });

  it('gives each tab at least a 44 dp target and floats above the edge', async () => {
    await render(
      <TabBar
        items={[{ key: 'h', label: 'Home', icon: 'tab-home', selected: true, onPress: noop }]}
        testID="bar"
      />,
    );
    expect(screen.getByRole('button')).toHaveStyle({
      width: size.tabItemWidth,
      height: size.tabItemHeight,
    });
    expect(Math.min(size.tabItemWidth, size.tabItemHeight)).toBeGreaterThanOrEqual(44);
    expect(screen.getByTestId('bar')).toHaveStyle({ bottom: size.tabBarBottomOffset });
  });
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
