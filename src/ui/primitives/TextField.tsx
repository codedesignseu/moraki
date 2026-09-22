import {
  StyleSheet,
  Text,
  TextInput,
  View,
  type KeyboardTypeOptions,
  type TextInputProps,
} from 'react-native';

import type { Theme } from '../theme';
import { useTheme } from '../theme';

type Props = {
  /** Visible label above the field; also its screen reader name. */
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  /** Hard cap: longer input is cut to this length, however it arrives (typing or paste). */
  maxLength?: number | undefined;
  multiline?: boolean | undefined;
  keyboardType?: KeyboardTypeOptions | undefined;
  /** Lets the system offer an email address or an emailed code. */
  autoComplete?: TextInputProps['autoComplete'];
  textContentType?: TextInputProps['textContentType'];
  autoCapitalize?: TextInputProps['autoCapitalize'];
  /** Small helper text under the field, e.g. a character count. The caller's copy. */
  hint?: string | undefined;
  /** Marks the field invalid. The message itself is the caller's. */
  invalid?: boolean | undefined;
  message?: string | undefined;
};

/** Text entry for notes and names. Styled only from tokens. */
export function TextField({
  label,
  value,
  onChangeText,
  maxLength,
  multiline = false,
  keyboardType,
  autoComplete,
  textContentType,
  autoCapitalize,
  hint,
  invalid = false,
  message,
}: Props) {
  const theme = useTheme();
  const s = styles(theme);
  return (
    <View style={s.wrap}>
      <Text style={s.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        accessibilityHint={invalid ? message : hint}
        value={value}
        onChangeText={(text) =>
          onChangeText(maxLength === undefined ? text : text.slice(0, maxLength))
        }
        maxLength={maxLength}
        multiline={multiline}
        keyboardType={keyboardType}
        autoComplete={autoComplete}
        textContentType={textContentType}
        autoCapitalize={autoCapitalize}
        placeholderTextColor={theme.colors.textMuted}
        style={[theme.text.body, s.input, multiline && s.multiline, invalid && s.invalid]}
      />
      {invalid && message ? (
        <Text accessibilityRole="alert" style={s.message}>
          {message}
        </Text>
      ) : hint ? (
        <Text style={s.hint}>{hint}</Text>
      ) : null}
    </View>
  );
}

const styles = (t: Theme) =>
  StyleSheet.create({
    wrap: { gap: t.spacing.xs },
    label: { ...t.text.label, color: t.colors.text },
    input: {
      minHeight: t.size.touchTarget,
      paddingHorizontal: t.spacing.md,
      paddingVertical: t.spacing.sm,
      borderRadius: t.radius.md,
      // Always drawn thick so switching to invalid never shifts layout.
      borderWidth: t.size.borderThick,
      borderColor: t.colors.borderStrong,
      backgroundColor: t.colors.surface,
      color: t.colors.text,
    },
    multiline: { minHeight: t.size.touchTargetLarge * 2, textAlignVertical: 'top' },
    invalid: { borderColor: t.colors.invalid },
    hint: { ...t.text.caption, color: t.colors.textMuted },
    message: { ...t.text.caption, color: t.colors.invalid },
  });
