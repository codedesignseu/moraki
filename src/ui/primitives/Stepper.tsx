import type { AccessibilityActionEvent } from 'react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { Theme } from '../theme';
import { useTheme } from '../theme';
import { Icon } from './Icon';

type Props = {
  value: number;
  onChange: (value: number) => void;
  step?: number;
  min?: number;
  max?: number;
  /** Shown after the number, e.g. "mL". */
  unit?: string;
  /** Names the control for screen readers, e.g. "Amount". */
  accessibilityLabel: string;
  disabled?: boolean;
  /** Value out of range for the form. The message itself is the caller's. */
  invalid?: boolean;
  /** `compact` sets the number at 32 instead of 48, for long values (the weight sheet's grams). */
  size?: 'regular' | 'compact';
  /** Renders one button pressed without a touch. Demo and tests only. */
  testOnly_pressed?: 'decrement' | 'increment';
};

/**
 * Amount entry for one-handed use: +/- at opposite ends so a thumb can hit
 * them without aiming. Screen readers get one adjustable control (swipe
 * up/down) instead of two separate buttons.
 *
 * G (sheets/feed-bottle, sheets/weight): a chip-coloured box, borderless round
 * card-coloured 52 buttons, the number in Comfortaa with the unit beside it in
 * soft text. Each button's hit slop takes its target to the 64 one-handed size.
 */
export function Stepper({
  value,
  onChange,
  step = 1,
  min = 0,
  max = Number.MAX_SAFE_INTEGER,
  unit,
  accessibilityLabel,
  disabled = false,
  invalid = false,
  size = 'regular',
  testOnly_pressed,
}: Props) {
  const theme = useTheme();
  const s = styles(theme);
  const valueText = unit ? `${value} ${unit}` : String(value);
  const canDecrement = !disabled && value > min;
  const canIncrement = !disabled && value < max;

  const decrement = () => {
    if (canDecrement) onChange(Math.max(min, value - step));
  };
  const increment = () => {
    if (canIncrement) onChange(Math.min(max, value + step));
  };

  const onAccessibilityAction = (event: AccessibilityActionEvent) => {
    if (event.nativeEvent.actionName === 'increment') increment();
    if (event.nativeEvent.actionName === 'decrement') decrement();
  };

  const slop = (theme.size.touchTargetLarge - theme.size.stepperButton) / 2;
  const stepButton = (kind: 'decrement' | 'increment', enabled: boolean, onPress: () => void) => (
    <Pressable
      onPress={onPress}
      disabled={!enabled}
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
      testID={`stepper-${kind}`}
      testOnly_pressed={testOnly_pressed === kind}
      hitSlop={slop}
      // A button at its bound keeps its card fill (night disabledFill is the
      // box colour) and shows the soft icon.
      style={({ pressed }) => [s.button, pressed && enabled && s.pressed]}
    >
      <Icon
        name={kind === 'decrement' ? 'minus' : 'plus'}
        color={enabled ? theme.palette.ink : theme.palette.disabledText}
      />
    </Pressable>
  );

  return (
    <View
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min, max, now: value, text: valueText }}
      accessibilityState={{ disabled }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={onAccessibilityAction}
      style={[s.row, invalid && s.invalid]}
    >
      {stepButton('decrement', canDecrement, decrement)}
      <Text
        style={[
          size === 'compact' ? theme.type.stepperValueCompact : theme.type.stepperValue,
          s.value,
          disabled && s.valueDisabled,
        ]}
      >
        {value}
        {unit ? <Text style={[theme.type.stepperUnit, s.unit]}>{` ${unit}`}</Text> : null}
      </Text>
      {stepButton('increment', canIncrement, increment)}
    </View>
  );
}

const styles = (t: Theme) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: t.spacing.md,
      padding: t.spacing.field,
      borderRadius: t.radius.stepper,
      backgroundColor: t.palette.chip,
      // Always drawn so switching to invalid never shifts layout.
      borderWidth: t.size.borderControl,
      borderColor: t.palette.chip,
    },
    invalid: { borderColor: t.palette.error },
    button: {
      width: t.size.stepperButton,
      height: t.size.stepperButton,
      borderRadius: t.radius.pill,
      backgroundColor: t.palette.card,
      alignItems: 'center',
      justifyContent: 'center',
    },
    pressed: { backgroundColor: t.palette.line },
    value: {
      flex: 1,
      textAlign: 'center',
      fontVariant: ['tabular-nums'],
    },
    valueDisabled: { color: t.palette.disabledText },
    unit: { color: t.palette.textSoft },
  });
