import { fireEvent, render, screen } from '@testing-library/react-native';
import { useState } from 'react';
import { Text } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ThemeProvider } from '../theme';
import { palette, radius, size, type, typography } from '../tokens';
import { Button, ChoiceButtons, Chip, InlineError, Segmented, Sheet, Stepper, TimerText } from '.';

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
    // G main button is 60 high, above the 48 touch target.
    expect(screen.getByRole('button')).toHaveStyle({ minHeight: size.button });
    expect(size.button).toBeGreaterThanOrEqual(size.touchTarget);
  });

  it('draws the outlined button 52 high with a 1.5 outline', async () => {
    await render(<Button label="Cancel" variant="secondary" icon="invite" onPress={noop} />);
    expect(screen.getByRole('button')).toHaveStyle({
      minHeight: size.buttonSecondary,
      borderWidth: size.borderControl,
      borderColor: palette.light.outline,
    });
    expect(size.buttonSecondary).toBeGreaterThanOrEqual(size.touchTarget);
  });

  it.each(['light', 'night'] as const)('uses the disabled tokens in %s', async (scheme) => {
    await render(
      <ThemeProvider scheme={scheme}>
        <Button label="Save" onPress={noop} disabled />
        <Button label="Cancel" variant="secondary" onPress={noop} disabled />
      </ThemeProvider>,
    );
    expect(screen.getByRole('button', { name: 'Save' })).toHaveStyle({
      backgroundColor: palette[scheme].disabledFill,
    });
    expect(screen.getByText('Save')).toHaveStyle({ color: palette[scheme].disabledText });
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveStyle({
      backgroundColor: 'transparent',
      borderColor: palette[scheme].line,
    });
  });

  it('ignores presses and says so while busy', async () => {
    const onPress = jest.fn();
    await render(<Button label="Save" onPress={onPress} busy />);
    const button = screen.getByRole('button', { name: 'Save' });
    await fireEvent.press(button);
    expect(onPress).not.toHaveBeenCalled();
    expect(button).toBeBusy();
    expect(screen.getByTestId('button-busy')).toBeOnTheScreen();
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

  it('reaches the large touch target for +/- through its hit slop', async () => {
    await render(<ControlledStepper initial={0} />);
    const button = screen.getByTestId('stepper-increment', HIDDEN);
    expect(button).toHaveStyle({ width: size.stepperButton, height: size.stepperButton });
    expect(size.stepperButton + 2 * button.props.hitSlop).toBe(size.touchTargetLarge);
  });

  it('sets the unit apart from the number and has a compact size', async () => {
    await render(
      <Stepper value={3240} onChange={noop} unit="g" accessibilityLabel="Grams" size="compact" />,
    );
    expect(screen.getByText('3240 g')).toHaveStyle({ fontSize: type.stepperValueCompact.fontSize });
    expect(screen.getByText(' g')).toHaveStyle({ fontSize: type.stepperUnit.fontSize });
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
      expect(radio).toHaveStyle({ minHeight: size.minTouch });
    }
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

  it.each(['light', 'night'] as const)(
    'is filled, and selected shows a check on the selected fill in %s',
    async (scheme) => {
      await render(
        <ThemeProvider scheme={scheme}>
          <Chip label="Rash" selected={false} onPress={noop} />
          <Chip label="Cough" selected onPress={noop} />
        </ThemeProvider>,
      );
      expect(screen.getByRole('togglebutton', { name: 'Rash' })).toHaveStyle({
        backgroundColor: palette[scheme].chip,
      });
      expect(screen.getByRole('togglebutton', { name: 'Cough' })).toHaveStyle({
        backgroundColor: palette[scheme].selected,
      });
      expect(screen.getByText('Cough')).toHaveStyle({ color: palette[scheme].onSelected });
      expect(screen.getAllByTestId('chip-check', HIDDEN)).toHaveLength(1);
    },
  );
});

describe('ChoiceButtons', () => {
  const kinds = [
    { value: 'bottle', label: 'Bottle', tone: 'feed' },
    { value: 'breast', label: 'Breast', tone: 'sleep' },
    { value: 'mixed', label: 'Mixed', tone: 'pump' },
  ] as const;

  it('is a set of radios that selects the pressed option', async () => {
    function Controlled() {
      const [value, setValue] = useState<'bottle' | 'breast' | 'mixed' | null>('bottle');
      return (
        <ChoiceButtons
          options={kinds}
          value={value}
          onChange={setValue}
          accessibilityLabel="Kind"
        />
      );
    }
    await render(<Controlled />);
    expect(screen.getAllByRole('radio')).toHaveLength(3);
    await fireEvent.press(screen.getByRole('radio', { name: 'Mixed' }));
    expect(screen.getByRole('radio', { name: 'Mixed' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Bottle' })).not.toBeChecked();
  });

  it.each(['light', 'night'] as const)(
    'fills each option with its tone and the chosen one with selected in %s',
    async (scheme) => {
      await render(
        <ThemeProvider scheme={scheme}>
          <ChoiceButtons options={kinds} value="bottle" onChange={noop} accessibilityLabel="Kind" />
        </ThemeProvider>,
      );
      expect(screen.getByRole('radio', { name: 'Bottle' })).toHaveStyle({
        backgroundColor: palette[scheme].selected,
        minHeight: size.choiceButton,
        borderRadius: radius.choice,
      });
      expect(screen.getByRole('radio', { name: 'Breast' })).toHaveStyle({
        backgroundColor: palette[scheme].sleep,
      });
    },
  );

  it('does not change when disabled', async () => {
    const onChange = jest.fn();
    await render(
      <ChoiceButtons
        options={kinds}
        value="bottle"
        onChange={onChange}
        accessibilityLabel="Kind"
        disabled
      />,
    );
    await fireEvent.press(screen.getByRole('radio', { name: 'Breast' }));
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole('radio', { name: 'Breast' })).toBeDisabled();
  });
});

describe('InlineError', () => {
  it.each(['light', 'night'] as const)(
    'is an alert with the prefix, in the error colour in %s',
    async (scheme) => {
      await render(
        <ThemeProvider scheme={scheme}>
          <InlineError prefix="Error" message="enter an amount above 0 ml." />
        </ThemeProvider>,
      );
      expect(screen.getByRole('alert')).toHaveTextContent('Error: enter an amount above 0 ml.');
      expect(screen.getByText('Error: enter an amount above 0 ml.')).toHaveStyle({
        color: palette[scheme].error,
      });
    },
  );
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
