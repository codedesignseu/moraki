import { Pressable, StyleSheet, Text } from 'react-native';

import type { Theme } from '../theme';
import { useTheme } from '../theme';

type Props = {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary';
  disabled?: boolean;
  /** Defaults to `label`. Set it when the visible label needs more context. */
  accessibilityLabel?: string;
  accessibilityHint?: string;
  /** Renders the pressed state without a touch. Demo and tests only. */
  testOnly_pressed?: boolean;
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  accessibilityLabel,
  accessibilityHint,
  testOnly_pressed,
}: Props) {
  const theme = useTheme();
  const s = styles(theme);
  const tone = disabled ? 'disabled' : variant;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled }}
      testOnly_pressed={testOnly_pressed}
      style={({ pressed }) => [s.base, s[tone], pressed && s[`${variant}Pressed`]]}
    >
      <Text style={[theme.text.bodyStrong, s[`${tone}Label`]]}>{label}</Text>
    </Pressable>
  );
}

const styles = (t: Theme) =>
  StyleSheet.create({
    base: {
      minHeight: t.size.touchTarget,
      paddingHorizontal: t.spacing.xl,
      paddingVertical: t.spacing.md,
      borderRadius: t.radius.md,
      borderWidth: t.size.borderThin,
      alignItems: 'center',
      justifyContent: 'center',
    },
    primary: { backgroundColor: t.colors.accent, borderColor: t.colors.accent },
    primaryPressed: {
      backgroundColor: t.colors.accentPressed,
      borderColor: t.colors.accentPressed,
    },
    primaryLabel: { color: t.colors.onAccent, textAlign: 'center' },
    secondary: { backgroundColor: t.colors.surface, borderColor: t.colors.borderStrong },
    secondaryPressed: { backgroundColor: t.colors.surfacePressed },
    secondaryLabel: { color: t.colors.text, textAlign: 'center' },
    disabled: { backgroundColor: t.colors.surfaceSunken, borderColor: t.colors.surfaceSunken },
    disabledLabel: { color: t.colors.textMuted, textAlign: 'center' },
  });
