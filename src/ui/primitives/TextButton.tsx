import { Pressable, StyleSheet, Text } from 'react-native';

import type { Theme } from '../theme';
import { useTheme } from '../theme';

type Props = {
  label: string;
  onPress: () => void;
  /** `destructive` sets the label in the error colour ("Revoke", "Remove"). */
  tone?: 'default' | 'destructive';
  /** Where the link sits in a column: at the start (default) or centred under a button. */
  align?: 'start' | 'center';
  disabled?: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
};

/**
 * A link-style action: underlined 16/700 text with a 48 touch target and no
 * fill (G: account/consent "Not now", tabs/settings "Review consent").
 */
export function TextButton({
  label,
  onPress,
  tone = 'default',
  align = 'start',
  disabled = false,
  accessibilityLabel,
  accessibilityHint,
}: Props) {
  const theme = useTheme();
  const s = styles(theme);
  const colour = disabled
    ? theme.palette.disabledText
    : tone === 'destructive'
      ? theme.palette.error
      : theme.palette.ink;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled }}
      style={({ pressed }) => [
        s.base,
        align === 'center' ? s.center : s.start,
        pressed && s.pressed,
      ]}
    >
      <Text style={[theme.type.buttonSecondary, s.label, { color: colour }]}>{label}</Text>
    </Pressable>
  );
}

const styles = (t: Theme) =>
  StyleSheet.create({
    base: { minHeight: t.size.minTouch, minWidth: t.size.minTouch, justifyContent: 'center' },
    start: { alignSelf: 'flex-start' },
    center: { alignSelf: 'center' },
    pressed: { opacity: t.opacity.pressed },
    label: { textDecorationLine: 'underline' },
  });
