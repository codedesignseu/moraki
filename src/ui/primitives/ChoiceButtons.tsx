import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { Theme } from '../theme';
import { useTheme } from '../theme';
import type { TileColour } from './ActivityTile';

export type ChoiceOption<T extends string> = {
  value: T;
  label: string;
  /** The button's fill while not chosen: a tile colour, or `chip` (the default). */
  tone?: TileColour | 'chip';
  accessibilityLabel?: string;
};

type Props<T extends string> = {
  options: readonly ChoiceOption<T>[];
  /** `null` when nothing is chosen yet. */
  value: T | null;
  onChange: (value: T) => void;
  /** Names the group for screen readers, e.g. "Kind". */
  accessibilityLabel: string;
  disabled?: boolean;
  /** A choice is required and missing. The message itself is the caller's. */
  invalid?: boolean;
  /** Renders one button pressed without a touch. Demo and tests only. */
  testOnly_pressedValue?: T;
};

/**
 * The kind choice at the top of a sheet (G: sheets/feed-bottle "Bottle,
 * Breast, Mixed"): equal 64-high buttons with corner 20, each in its own tile
 * colour. The chosen one takes the selected fill and a heavier label.
 */
export function ChoiceButtons<T extends string>({
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
        const fill = disabled
          ? theme.palette.disabledFill
          : selected
            ? theme.palette.selected
            : theme.palette[option.tone ?? 'chip'];
        const colour = disabled
          ? theme.palette.disabledText
          : selected
            ? theme.palette.onSelected
            : theme.palette.ink;
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
              s.button,
              { backgroundColor: fill },
              pressed && !disabled && s.pressed,
            ]}
          >
            <Text
              style={[
                selected ? theme.type.detailHeavy : theme.type.detailBold,
                s.label,
                { color: colour },
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
      gap: t.spacing.sm,
      borderRadius: t.radius.choice,
      // Always drawn so switching to invalid never shifts layout.
      borderWidth: t.size.borderControl,
      borderColor: 'transparent',
    },
    invalid: { borderColor: t.palette.error },
    button: {
      flex: 1,
      minHeight: t.size.choiceButton,
      paddingHorizontal: t.spacing.xs,
      borderRadius: t.radius.choice,
      alignItems: 'center',
      justifyContent: 'center',
    },
    pressed: { opacity: t.opacity.pressed },
    label: { textAlign: 'center' },
  });
