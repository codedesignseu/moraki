import { Pressable, StyleSheet, Text } from 'react-native';

import type { Theme } from '../theme';
import { useTheme } from '../theme';

type Props = {
  label: string;
  selected: boolean;
  onPress: () => void;
  disabled?: boolean;
  accessibilityLabel?: string;
  /** Renders the pressed state without a touch. Demo and tests only. */
  testOnly_pressed?: boolean;
};

/** Toggleable filter. The visual pill is compact but the hit area is a full touch target. */
export function Chip({
  label,
  selected,
  onPress,
  disabled = false,
  accessibilityLabel,
  testOnly_pressed,
}: Props) {
  const theme = useTheme();
  const s = styles(theme);
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
        selected && s.selected,
        // A pressed selected chip dims instead of turning light, so its light
        // label stays readable.
        pressed && (selected ? s.selectedPressed : s.pressed),
        disabled && s.disabled,
      ]}
    >
      <Text
        style={[
          theme.text.label,
          disabled ? s.disabledLabel : selected ? s.selectedLabel : s.label,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = (t: Theme) =>
  StyleSheet.create({
    base: {
      minHeight: t.size.touchTarget,
      paddingHorizontal: t.spacing.lg,
      borderRadius: t.radius.pill,
      borderWidth: t.size.borderThin,
      borderColor: t.colors.borderStrong,
      backgroundColor: t.colors.surface,
      alignSelf: 'flex-start',
      justifyContent: 'center',
    },
    // Stone: a dark fill by day with a light label. At night the fill is
    // close to the card, so the ink ring marks it too: shape, not only colour.
    selected: {
      backgroundColor: t.palette.selected,
      borderColor: t.palette.ink,
      borderWidth: t.size.borderThick,
    },
    selectedPressed: { opacity: t.opacity.pressed },
    selectedLabel: { color: t.palette.onSelected },
    pressed: { backgroundColor: t.colors.surfacePressed },
    disabled: { backgroundColor: t.colors.surfaceSunken, borderColor: t.colors.surfaceSunken },
    label: { color: t.colors.text },
    disabledLabel: { color: t.colors.textMuted },
  });
