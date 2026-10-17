import { Pressable, StyleSheet, Text } from 'react-native';

import type { Theme } from '../theme';
import { useTheme } from '../theme';
import { Icon } from './Icon';

type Props = {
  label: string;
  selected: boolean;
  onPress: () => void;
  disabled?: boolean;
  /**
   * The chip's fill when not selected. `chip` (default) on a card or sheet;
   * `card` on the screen background, as History's filters are drawn.
   */
  fill?: 'chip' | 'card';
  accessibilityLabel?: string;
  /** Renders the pressed state without a touch. Demo and tests only. */
  testOnly_pressed?: boolean;
};

/**
 * Toggleable choice (G: filled, no border, 48 high). Selected is the dark
 * selected fill with a check icon, so it reads by shape as well as colour.
 */
export function Chip({
  label,
  selected,
  onPress,
  disabled = false,
  fill = 'chip',
  accessibilityLabel,
  testOnly_pressed,
}: Props) {
  const theme = useTheme();
  const s = styles(theme);
  const labelColour = disabled
    ? theme.palette.disabledText
    : selected
      ? theme.palette.onSelected
      : theme.palette.ink;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="togglebutton"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ checked: selected, disabled }}
      testOnly_pressed={testOnly_pressed}
      style={({ pressed }) => [
        s.base,
        { backgroundColor: theme.palette[fill] },
        selected && s.selected,
        // A pressed selected chip dims instead of turning light, so its light
        // label stays readable.
        pressed && (selected ? s.selectedPressed : s.pressed),
        disabled && s.disabled,
      ]}
    >
      {selected ? (
        <Icon name="check" size={theme.size.iconError} color={labelColour} testID="chip-check" />
      ) : null}
      <Text style={[selected ? theme.type.detailBold : theme.type.detail, { color: labelColour }]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = (t: Theme) =>
  StyleSheet.create({
    base: {
      minHeight: t.size.minTouch,
      paddingHorizontal: t.spacing.lg,
      borderRadius: t.radius.chip,
      alignSelf: 'flex-start',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: t.spacing.xs,
    },
    selected: { backgroundColor: t.palette.selected },
    selectedPressed: { opacity: t.opacity.pressed },
    pressed: { backgroundColor: t.palette.line },
    disabled: { backgroundColor: t.palette.disabledFill },
  });
