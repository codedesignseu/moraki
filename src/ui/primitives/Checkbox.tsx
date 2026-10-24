import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { Theme } from '../theme';
import { useTheme } from '../theme';
import { Icon } from './Icon';
import { InlineError } from './InlineError';

type Props = {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** Marks it as still needed; the message itself is the caller's. */
  invalid?: boolean;
  message?: string | undefined;
  errorPrefix?: string;
  testID?: string;
};

/**
 * A statement the person ticks themselves: a declaration or an agreement.
 * Never ticked by default; the caller starts it unchecked. The whole row is
 * the touch target, and a ticked box shows a check, not only a fill.
 */
export function Checkbox({
  label,
  checked,
  onChange,
  invalid = false,
  message,
  errorPrefix,
  testID,
}: Props) {
  const theme = useTheme();
  const s = styles(theme);
  return (
    <View style={s.wrap}>
      <Pressable
        onPress={() => onChange(!checked)}
        accessibilityRole="checkbox"
        accessibilityLabel={label}
        accessibilityState={{ checked }}
        accessibilityHint={invalid ? message : undefined}
        testID={testID}
        style={({ pressed }) => [s.row, pressed && s.pressed]}
      >
        <View style={[s.box, checked && s.checked, invalid && !checked && s.invalid]}>
          {checked ? (
            <Icon name="check" size={theme.size.iconError} color={theme.palette.onSelected} />
          ) : null}
        </View>
        <Text style={s.label}>{label}</Text>
      </Pressable>
      {invalid && message ? <InlineError message={message} prefix={errorPrefix} /> : null}
    </View>
  );
}

const styles = (t: Theme) =>
  StyleSheet.create({
    wrap: { gap: t.spacing.xs },
    row: {
      minHeight: t.size.minTouch,
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: t.spacing.md,
      paddingVertical: t.spacing.xs,
    },
    pressed: { opacity: t.opacity.pressed },
    box: {
      width: t.size.checkbox,
      height: t.size.checkbox,
      borderRadius: t.radius.sm,
      borderWidth: t.size.borderControl,
      borderColor: t.palette.inputBorder,
      alignItems: 'center',
      justifyContent: 'center',
    },
    checked: { backgroundColor: t.palette.selected, borderColor: t.palette.selected },
    invalid: { borderColor: t.palette.error },
    label: { ...t.type.body, flex: 1, color: t.palette.ink },
  });
