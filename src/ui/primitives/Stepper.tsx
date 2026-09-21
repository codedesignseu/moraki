import type { AccessibilityActionEvent } from 'react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { Theme } from '../theme';
import { useTheme } from '../theme';

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
  /** Renders one button pressed without a touch. Demo and tests only. */
  testOnly_pressed?: 'decrement' | 'increment';
};

const DECREMENT = '−';
const INCREMENT = '+';

/**
 * Amount entry for one-handed use: large +/- targets at opposite ends so a
 * thumb can hit them without aiming. Screen readers get one adjustable
 * control (swipe up/down) instead of two separate buttons.
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

  const stepButton = (kind: 'decrement' | 'increment', enabled: boolean, onPress: () => void) => (
    <Pressable
      onPress={onPress}
      disabled={!enabled}
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
      testID={`stepper-${kind}`}
      testOnly_pressed={testOnly_pressed === kind}
      style={({ pressed }) => [s.button, pressed && s.pressed, !enabled && s.buttonDisabled]}
    >
      <Text style={[theme.text.title, enabled ? s.symbol : s.symbolDisabled]}>
        {kind === 'decrement' ? DECREMENT : INCREMENT}
      </Text>
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
      <Text style={[theme.text.title, s.value, disabled && s.symbolDisabled]}>{valueText}</Text>
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
      padding: t.spacing.xs,
      borderRadius: t.radius.lg,
      // Always drawn so switching to invalid never shifts layout.
      borderWidth: t.size.borderThick,
      borderColor: 'transparent',
    },
    invalid: { borderColor: t.colors.invalid },
    button: {
      minWidth: t.size.touchTargetLarge,
      minHeight: t.size.touchTargetLarge,
      borderRadius: t.radius.lg,
      borderWidth: t.size.borderThin,
      borderColor: t.colors.borderStrong,
      backgroundColor: t.colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    pressed: { backgroundColor: t.colors.surfacePressed },
    buttonDisabled: {
      backgroundColor: t.colors.surfaceSunken,
      borderColor: t.colors.surfaceSunken,
    },
    symbol: { color: t.colors.text },
    symbolDisabled: { color: t.colors.textMuted },
    value: {
      flex: 1,
      textAlign: 'center',
      fontVariant: ['tabular-nums'],
      color: t.colors.text,
    },
  });
