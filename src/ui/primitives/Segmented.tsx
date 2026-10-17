import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { Theme } from '../theme';
import { useTheme } from '../theme';

export type SegmentedOption<T extends string> = {
  value: T;
  label: string;
  accessibilityLabel?: string;
};

type Props<T extends string> = {
  options: readonly SegmentedOption<T>[];
  /** `null` when nothing is chosen yet. */
  value: T | null;
  onChange: (value: T) => void;
  /** Names the group for screen readers, e.g. "Diaper". */
  accessibilityLabel: string;
  disabled?: boolean;
  /** A choice is required and missing. The message itself is the caller's. */
  invalid?: boolean;
  /** Renders one segment pressed without a touch. Demo and tests only. */
  testOnly_pressedValue?: T;
};

/**
 * A small set of exclusive choices: wet, dirty, both; left, right. G: a
 * chip-coloured track with 48-high round segments; the chosen one takes the
 * selected fill and a heavier label.
 */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  accessibilityLabel,
  disabled = false,
  invalid = false,
  testOnly_pressedValue,
}: Props<T>) {
  const theme = useTheme();
  const s = styles(theme);
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={accessibilityLabel}
      style={[s.group, invalid && s.invalid]}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            disabled={disabled}
            accessibilityRole="radio"
            accessibilityLabel={option.accessibilityLabel ?? option.label}
            accessibilityState={{ checked: selected, disabled }}
            testOnly_pressed={testOnly_pressedValue === option.value}
            style={({ pressed }) => [
              s.segment,
              pressed && !selected && s.pressed,
              selected && (disabled ? s.selectedDisabled : s.selected),
            ]}
          >
            <Text
              style={[
                selected ? theme.type.detailHeavy : theme.type.detail,
                s.label,
                disabled && s.disabledLabel,
                selected && !disabled && s.selectedLabel,
              ]}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = (t: Theme) =>
  StyleSheet.create({
    group: {
      flexDirection: 'row',
      gap: t.spacing.xs,
      padding: t.spacing.track,
      borderRadius: t.radius.pill,
      backgroundColor: t.palette.chip,
      // Always drawn so switching to invalid never shifts layout.
      borderWidth: t.size.borderControl,
      borderColor: t.palette.chip,
    },
    invalid: { borderColor: t.palette.error },
    segment: {
      flex: 1,
      minHeight: t.size.minTouch,
      paddingHorizontal: t.spacing.sm,
      borderRadius: t.radius.pill,
      alignItems: 'center',
      justifyContent: 'center',
    },
    pressed: { backgroundColor: t.palette.line },
    selected: { backgroundColor: t.palette.selected },
    // At night disabledFill is the track colour, so a disabled choice keeps the line fill.
    selectedDisabled: { backgroundColor: t.palette.line },
    label: { color: t.palette.ink, textAlign: 'center' },
    selectedLabel: { color: t.palette.onSelected },
    disabledLabel: { color: t.palette.disabledText },
  });
