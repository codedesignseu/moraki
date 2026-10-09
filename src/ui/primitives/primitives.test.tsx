import { fireEvent, render, screen } from '@testing-library/react-native';
import { useState } from 'react';
import { Text } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { size, typography } from '../tokens';
import { Button, Chip, Segmented, Sheet, Stepper, TimerText } from '.';

const noop = () => {};

// Stepper +/- are hidden from screen readers on purpose: the whole control is
// one adjustable element. Sighted touch still reaches them.
const HIDDEN = { includeHiddenElements: true };

const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

describe('Button', () => {
  it('fires onPress', async () => {
    const onPress = jest.fn();
    await render(<Button label="Save" onPress={onPress} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('does not fire when disabled and says so to screen readers', async () => {
    const onPress = jest.fn();
    await render(<Button label="Save" onPress={onPress} disabled />);
    const button = screen.getByRole('button', { name: 'Save' });
    await fireEvent.press(button);
    expect(onPress).not.toHaveBeenCalled();
    expect(button).toBeDisabled();
  });

  it('meets the touch target', async () => {
    await render(<Button label="Save" onPress={noop} />);
    // Sage main button is 60 high, above the 48 touch target.
    expect(screen.getByRole('button')).toHaveStyle({ minHeight: size.button });
    expect(size.button).toBeGreaterThanOrEqual(size.touchTarget);
  });
});

function ControlledStepper(props: { initial: number; step?: number; min?: number; max?: number }) {
  const [value, setValue] = useState(props.initial);
  return (
    <Stepper
      value={value}
      onChange={setValue}
      unit="mL"
      accessibilityLabel="Amount"
      {...(props.step !== undefined && { step: props.step })}
      {...(props.min !== undefined && { min: props.min })}
      {...(props.max !== undefined && { max: props.max })}
    />
  );
}

describe('Stepper', () => {
  it('increments and decrements by step', async () => {
    await render(<ControlledStepper initial={60} step={10} />);
    await fireEvent.press(screen.getByTestId('stepper-increment', HIDDEN));
    await fireEvent.press(screen.getByTestId('stepper-increment', HIDDEN));
    expect(screen.getByText('80 mL')).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('stepper-decrement', HIDDEN));
    expect(screen.getByText('70 mL')).toBeOnTheScreen();
  });

  it('clamps to min and max and disables the button at the bound', async () => {
    await render(<ControlledStepper initial={5} step={10} min={0} max={20} />);
    await fireEvent.press(screen.getByTestId('stepper-decrement', HIDDEN));
    expect(screen.getByText('0 mL')).toBeOnTheScreen();
    expect(screen.getByTestId('stepper-decrement', HIDDEN)).toBeDisabled();
    await fireEvent.press(screen.getByTestId('stepper-increment', HIDDEN));
    await fireEvent.press(screen.getByTestId('stepper-increment', HIDDEN));
    await fireEvent.press(screen.getByTestId('stepper-increment', HIDDEN));
    expect(screen.getByText('20 mL')).toBeOnTheScreen();
    expect(screen.getByTestId('stepper-increment', HIDDEN)).toBeDisabled();
  });

  it('is one adjustable control for screen readers', async () => {
    await render(<ControlledStepper initial={60} step={10} />);
    const control = screen.getByRole('adjustable', { name: 'Amount' });
    expect(control).toHaveAccessibilityValue({ now: 60, text: '60 mL' });
    await fireEvent(control, 'accessibilityAction', { nativeEvent: { actionName: 'increment' } });
    expect(control).toHaveAccessibilityValue({ now: 70 });
    await fireEvent(control, 'accessibilityAction', { nativeEvent: { actionName: 'decrement' } });
    await fireEvent(control, 'accessibilityAction', { nativeEvent: { actionName: 'decrement' } });
    expect(control).toHaveAccessibilityValue({ now: 50 });
  });

  it('uses the large touch target for +/-', async () => {
    await render(<ControlledStepper initial={0} />);
    expect(screen.getByTestId('stepper-increment', HIDDEN)).toHaveStyle({
      minWidth: size.touchTargetLarge,
      minHeight: size.touchTargetLarge,
    });
  });

  it('does nothing when disabled', async () => {
    const onChange = jest.fn();
    await render(<Stepper value={10} onChange={onChange} accessibilityLabel="Amount" disabled />);
    await fireEvent.press(screen.getByTestId('stepper-increment', HIDDEN));
    await fireEvent.press(screen.getByTestId('stepper-decrement', HIDDEN));
    expect(onChange).not.toHaveBeenCalled();
  });
});

const diaper = [
  { value: 'wet', label: 'Wet' },
  { value: 'dirty', label: 'Dirty' },
  { value: 'both', label: 'Both' },
] as const;

describe('Segmented', () => {
  it('selects the pressed option', async () => {
    function Controlled() {
      const [value, setValue] = useState<'wet' | 'dirty' | 'both' | null>(null);
      return (
        <Segmented options={diaper} value={value} onChange={setValue} accessibilityLabel="Diaper" />
      );
    }
    await render(<Controlled />);
    expect(screen.getByRole('radio', { name: 'Dirty' })).not.toBeChecked();
    await fireEvent.press(screen.getByRole('radio', { name: 'Dirty' }));
    expect(screen.getByRole('radio', { name: 'Dirty' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Wet' })).not.toBeChecked();
  });

  it('does not change when disabled', async () => {
    const onChange = jest.fn();
    await render(
      <Segmented
        options={diaper}
        value="wet"
        onChange={onChange}
        accessibilityLabel="Diaper"
        disabled
      />,
    );
    await fireEvent.press(screen.getByRole('radio', { name: 'Both' }));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('meets the touch target per segment', async () => {
    await render(
      <Segmented options={diaper} value={null} onChange={noop} accessibilityLabel="Diaper" />,
    );
    for (const radio of screen.getAllByRole('radio')) {
      expect(radio).toHaveStyle({ minHeight: size.buttonSmall });
    }
    expect(size.buttonSmall).toBeGreaterThanOrEqual(size.touchTarget);
  });
});

describe('Chip', () => {
  it('reports selection and fires onPress', async () => {
    const onPress = jest.fn();
    await render(<Chip label="Feeds" selected onPress={onPress} />);
    const chip = screen.getByRole('togglebutton', { name: 'Feeds' });
    // RNTL's toBeChecked doesn't cover the togglebutton role.
    expect(chip.props.accessibilityState).toMatchObject({ checked: true });
    expect(chip).toHaveStyle({ minHeight: size.touchTarget });
    await fireEvent.press(chip);
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});

describe('TimerText', () => {
  it('uses tabular figures on one line and exposes a spoken label', async () => {
    await render(<TimerText text="2h 18m" accessibilityLabel="2 hours 18 minutes" />);
    const timer = screen.getByRole('timer', { name: '2 hours 18 minutes' });
    expect(timer).toHaveTextContent('2h 18m');
    expect(timer).toHaveStyle({ fontVariant: [...typography.timer.fontVariant] });
    expect(timer.props.numberOfLines).toBe(1);
  });
});

describe('Sheet', () => {
  it('shows its content when visible and closes from the scrim', async () => {
    const onClose = jest.fn();
    await render(
      <SafeAreaProvider initialMetrics={metrics}>
        <Sheet visible onClose={onClose} closeLabel="Close" title="Feed">
          <Text>form</Text>
        </Sheet>
      </SafeAreaProvider>,
    );
    expect(screen.getByRole('header', { name: 'Feed' })).toBeOnTheScreen();
    expect(screen.getByText('form')).toBeOnTheScreen();
    // iOS hides the scrim from VoiceOver behind the modal panel; TalkBack still reaches it.
    await fireEvent.press(screen.getByTestId('sheet-scrim', HIDDEN));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('sheet-scrim', HIDDEN).props.accessibilityLabel).toBe('Close');
  });

  it('closes on the VoiceOver escape gesture', async () => {
    const onClose = jest.fn();
    await render(
      <SafeAreaProvider initialMetrics={metrics}>
        <Sheet visible onClose={onClose} closeLabel="Close" title="Feed">
          <Text>form</Text>
        </Sheet>
      </SafeAreaProvider>,
    );
    const panel = screen.getByText('form', HIDDEN).parent;
    let node = panel;
    while (node && !node.props.onAccessibilityEscape) node = node.parent;
    expect(node).toBeTruthy();
    await fireEvent(node!, 'accessibilityEscape');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('renders nothing when hidden', async () => {
    await render(
      <Sheet visible={false} onClose={noop} closeLabel="Close">
        <Text>form</Text>
      </Sheet>,
    );
    expect(screen.queryByText('form')).not.toBeOnTheScreen();
  });
});
