import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';

import type { IconName } from '../icons';
import type { Theme } from '../theme';
import { useTheme } from '../theme';
import { Icon } from './Icon';

type Props = {
  label: string;
  onPress: () => void;
  /** `primary` is the one dark main button; `secondary` is outlined. */
  variant?: 'primary' | 'secondary';
  disabled?: boolean;
  /**
   * Work is under way: a spinner shows before the label, presses are ignored
   * and screen readers hear "busy". The label stays, so the button keeps its size.
   */
  busy?: boolean;
  /** A line icon before the label ("Invite someone", "Share", "Delete"). */
  icon?: IconName;
  /** Defaults to `label`. Set it when the visible label needs more context. */
  accessibilityLabel?: string;
  accessibilityHint?: string;
  /** Renders the pressed state without a touch. Demo and tests only. */
  testOnly_pressed?: boolean;
};

/**
 * G buttons (screens/foundations and every sheet): the main button is 60
 * high, fully round and dark; the outlined one is 52 high with a 1.5 outline.
 * Disabled uses the disabled tokens; an outlined button stays transparent and
 * keeps a line-coloured edge.
 */
export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  busy = false,
  icon,
  accessibilityLabel,
  accessibilityHint,
  testOnly_pressed,
}: Props) {
  const theme = useTheme();
  const s = styles(theme);
  const primary = variant === 'primary';
  const inactive = disabled || busy;
  const labelColour = disabled
    ? theme.palette.disabledText
    : primary
      ? theme.palette.onButtonPrimary
      : theme.palette.ink;
  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled, busy }}
      testOnly_pressed={testOnly_pressed}
      style={({ pressed }) => [
        s.base,
        primary ? s.primary : s.secondary,
        disabled && (primary ? s.primaryDisabled : s.secondaryDisabled),
        pressed && !inactive && (primary ? s.primaryPressed : s.secondaryPressed),
      ]}
    >
      {busy ? (
        <ActivityIndicator color={labelColour} testID="button-busy" />
      ) : icon ? (
        <Icon name={icon} size={theme.size.iconField} color={labelColour} />
      ) : null}
      <Text
        style={[
          primary ? theme.type.button : theme.type.buttonSecondary,
          s.label,
          { color: labelColour },
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
      flexDirection: 'row',
      gap: t.spacing.sm,
      paddingHorizontal: t.spacing.xl,
      paddingVertical: t.spacing.sm,
      borderRadius: t.radius.button,
      alignItems: 'center',
      justifyContent: 'center',
    },
    primary: { minHeight: t.size.button, backgroundColor: t.palette.buttonPrimary },
    primaryPressed: { opacity: t.opacity.pressed },
    primaryDisabled: { backgroundColor: t.palette.disabledFill },
    // Outlined: the label carries the meaning, the outline only groups it.
    secondary: {
      minHeight: t.size.buttonSecondary,
      backgroundColor: 'transparent',
      borderWidth: t.size.borderControl,
      borderColor: t.palette.outline,
    },
    secondaryPressed: { backgroundColor: t.palette.line },
    secondaryDisabled: { borderColor: t.palette.line },
    label: { textAlign: 'center', flexShrink: 1 },
  });
