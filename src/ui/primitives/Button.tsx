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
    // Sage: 60 high, fully round. The primary is the one dark button.
    base: {
      minHeight: t.size.button,
      paddingHorizontal: t.spacing.xl,
      paddingVertical: t.spacing.md,
      borderRadius: t.radius.pill,
      borderWidth: t.size.borderThick,
      alignItems: 'center',
      justifyContent: 'center',
    },
    primary: { backgroundColor: t.palette.buttonPrimary, borderColor: t.palette.buttonPrimary },
    primaryPressed: { opacity: t.opacity.pressed },
    primaryLabel: { color: t.palette.onButtonPrimary, textAlign: 'center' },
    // Outlined: the label carries the meaning, the outline only groups it.
    secondary: { backgroundColor: 'transparent', borderColor: t.palette.outline },
    secondaryPressed: { backgroundColor: t.palette.line },
    secondaryLabel: { color: t.palette.ink, textAlign: 'center' },
    disabled: { backgroundColor: t.palette.chip, borderColor: t.palette.chip },
    disabledLabel: { color: t.palette.textSoft, textAlign: 'center' },
  });
