import { Pressable, StyleSheet, Text } from 'react-native';

import type { IconName } from '../icons';
import type { Theme } from '../theme';
import { useTheme } from '../theme';
import { Icon } from './Icon';

type Props = {
  label: string;
  onPress: () => void;
  /** `dark`: the hero's "Log a feed". `outlined`: a card's "Adjust". */
  variant?: 'dark' | 'outlined';
  icon?: IconName;
  disabled?: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  /** Renders the pressed state without a touch. Demo and tests only. */
  testOnly_pressed?: boolean;
};

/** A small inline button, 48 high and as wide as its label (G: tabs/home). */
export function PillButton({
  label,
  onPress,
  variant = 'dark',
  icon,
  disabled = false,
  accessibilityLabel,
  accessibilityHint,
  testOnly_pressed,
}: Props) {
  const theme = useTheme();
  const s = styles(theme);
  const dark = variant === 'dark';
  const colour = disabled
    ? theme.palette.disabledText
    : dark
      ? theme.palette.onButtonPrimary
      : theme.palette.ink;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled }}
      testOnly_pressed={testOnly_pressed}
      style={({ pressed }) => [
        s.base,
        dark ? s.dark : s.outlined,
        disabled && (dark ? s.darkDisabled : s.outlinedDisabled),
        pressed && !disabled && (dark ? s.darkPressed : s.outlinedPressed),
      ]}
    >
      {icon ? <Icon name={icon} size={theme.size.iconField} color={colour} /> : null}
      <Text style={[dark ? theme.type.detailHeavy : theme.type.buttonSecondary, { color: colour }]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = (t: Theme) =>
  StyleSheet.create({
    base: {
      alignSelf: 'flex-start',
      minHeight: t.size.minTouch,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: t.spacing.sm,
      borderRadius: t.radius.pill,
    },
    dark: { paddingHorizontal: t.spacing.pill, backgroundColor: t.palette.buttonPrimary },
    darkPressed: { opacity: t.opacity.pressed },
    darkDisabled: { backgroundColor: t.palette.disabledFill },
    outlined: {
      paddingHorizontal: t.spacing.screenEdge,
      borderWidth: t.size.borderControl,
      borderColor: t.palette.outline,
    },
    outlinedPressed: { backgroundColor: t.palette.line },
    outlinedDisabled: { borderColor: t.palette.line },
  });
