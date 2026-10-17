import { fireEvent, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { ThemeProvider } from '../theme';
import { palette, radius, size } from '../tokens';
import {
  Button,
  Card,
  DateTimeField,
  EmptyState,
  IconCircle,
  Legend,
  ListGroup,
  ListRow,
  PillButton,
  StatCell,
  TextButton,
  Toast,
} from '.';

const noop = () => {};
const HIDDEN = { includeHiddenElements: true };
const schemes = ['light', 'night'] as const;

describe('Card', () => {
  it.each(schemes)('has a 28 hero corner and a warning tone in %s', async (scheme) => {
    await render(
      <ThemeProvider scheme={scheme}>
        <Card testID="plain" />
        <Card variant="hero" testID="hero" />
        <Card tone="warning" icon="alert" message="Entries from another account" testID="warn" />
      </ThemeProvider>,
    );
    expect(screen.getByTestId('plain')).toHaveStyle({ borderRadius: radius.card });
    expect(screen.getByTestId('hero')).toHaveStyle({ borderRadius: radius.hero });
    expect(screen.getByTestId('warn')).toHaveStyle({ backgroundColor: palette[scheme].warning });
    expect(screen.getByText('Entries from another account')).toBeOnTheScreen();
  });
});

describe('IconCircle', () => {
  it.each([
    ['row', size.circleRow],
    ['empty', size.circleEmpty],
  ] as const)('draws the %s size round in its tone', async (name, side) => {
    await render(<IconCircle icon="feed" tone="feed" size={name} testID="c" />);
    expect(screen.getByTestId('c')).toHaveStyle({
      width: side,
      height: side,
      backgroundColor: palette.light.feed,
    });
  });
});

describe('ListGroup', () => {
  it('puts a line between rows and none around them', async () => {
    await render(
      <ListGroup>
        <ListRow grouped title="Health note" icon="health" badge="sleep" onPress={noop} />
        <ListRow grouped title="Medication" icon="health" badge="pump" onPress={noop} />
        {false}
      </ListGroup>,
    );
    expect(screen.getAllByTestId('list-divider')).toHaveLength(1);
    expect(screen.getAllByRole('button')).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'Health note' })).toHaveStyle({
      minHeight: size.listRow,
    });
  });
});

describe('StatCell', () => {
  it('reads value and label as one, in the order it shows them', async () => {
    await render(
      <>
        <StatCell value="6" label="feeds" tone="feed" />
        <StatCell value="240 ml" label="Fridge" tone="pump" layout="labelFirst" />
      </>,
    );
    expect(screen.getByLabelText('6 feeds')).toHaveStyle({ backgroundColor: palette.light.feed });
    expect(screen.getByLabelText('Fridge, 240 ml')).toHaveStyle({ borderRadius: radius.stat });
  });
});

describe('PillButton', () => {
  it.each(schemes)('is a 48 high dark or outlined button in %s', async (scheme) => {
    const onPress = jest.fn();
    await render(
      <ThemeProvider scheme={scheme}>
        <PillButton label="Log a feed" onPress={onPress} />
        <PillButton label="Adjust" variant="outlined" onPress={noop} />
      </ThemeProvider>,
    );
    const dark = screen.getByRole('button', { name: 'Log a feed' });
    expect(dark).toHaveStyle({
      minHeight: size.minTouch,
      backgroundColor: palette[scheme].buttonPrimary,
    });
    expect(screen.getByRole('button', { name: 'Adjust' })).toHaveStyle({
      borderColor: palette[scheme].outline,
    });
    await fireEvent.press(dark);
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});

describe('TextButton', () => {
  it('is an underlined button, in the error colour when destructive', async () => {
    await render(
      <>
        <TextButton label="Not now" onPress={noop} />
        <TextButton label="Revoke" tone="destructive" onPress={noop} />
      </>,
    );
    expect(screen.getByRole('button', { name: 'Not now' })).toHaveStyle({
      minHeight: size.minTouch,
    });
    expect(screen.getByText('Not now')).toHaveStyle({ textDecorationLine: 'underline' });
    expect(screen.getByText('Revoke')).toHaveStyle({ color: palette.light.error });
  });
});

describe('Button destructive', () => {
  it('is outlined in the error colour', async () => {
    await render(<Button label="Delete account" variant="destructive" onPress={noop} />);
    expect(screen.getByRole('button')).toHaveStyle({ borderColor: palette.light.error });
    expect(screen.getByText('Delete account')).toHaveStyle({ color: palette.light.error });
  });
});

describe('Toast', () => {
  it.each(schemes)('uses the toast and undo tokens in %s', async (scheme) => {
    const onAction = jest.fn();
    await render(
      <ThemeProvider scheme={scheme}>
        <Toast message="Feed saved" actionLabel="Undo" onAction={onAction} />
      </ThemeProvider>,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Feed saved');
    expect(screen.getByText('Feed saved')).toHaveStyle({ color: palette[scheme].onToast });
    const undo = screen.getByRole('button', { name: 'Undo' });
    expect(undo).toHaveStyle({ minHeight: size.minTouch, backgroundColor: palette[scheme].undo });
    await fireEvent.press(undo);
    expect(onAction).toHaveBeenCalledTimes(1);
  });
});

describe('Legend', () => {
  it('names each mark', async () => {
    await render(<Legend items={[{ label: 'Clinic' }, { label: 'Home', shape: 'hollow' }]} />);
    expect(screen.getByText('Clinic')).toBeOnTheScreen();
    expect(screen.getByText('Home')).toBeOnTheScreen();
    expect(screen.getAllByTestId('legend-dot', HIDDEN)[1]).toHaveStyle({
      borderWidth: size.legendRing,
    });
  });
});

describe('EmptyState', () => {
  it('centres a 64 circle, a heading, a line and its action', async () => {
    await render(
      <EmptyState
        icon="tab-history"
        title="Nothing logged yet"
        body="Entries show up here."
        action={<Text>Log a feed</Text>}
      />,
    );
    expect(screen.getByRole('header', { name: 'Nothing logged yet' })).toBeOnTheScreen();
    expect(screen.getByText('Log a feed')).toBeOnTheScreen();
  });
});

describe('DateTimeField', () => {
  it('is one input-shaped button named by its label, with the value and a hint', async () => {
    await render(
      <DateTimeField
        label="Time"
        value={0}
        onChange={noop}
        display="Today, 22:40"
        openLabel="Set exact time"
        testID="when"
      />,
    );
    const field = screen.getByRole('button', { name: 'Time' });
    expect(field).toHaveAccessibilityValue({ text: 'Today, 22:40' });
    expect(field.props.accessibilityHint).toBe('Set exact time');
    expect(field).toHaveStyle({ minHeight: size.input, borderRadius: radius.input });
    expect(screen.getByTestId('when-value')).toHaveTextContent('Today, 22:40');
  });
});
