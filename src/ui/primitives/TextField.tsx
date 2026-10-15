import { useState } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  View,
  type KeyboardTypeOptions,
  type TextInputProps,
} from 'react-native';

import type { IconName } from '../icons';
import type { Theme } from '../theme';
import { useTheme } from '../theme';
import { Icon } from './Icon';
import { InlineError } from './InlineError';

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
  /** A line icon at the start of the field (mail on sign-in). Decorative. */
  icon?: IconName | undefined;
  /** A unit after the value, e.g. "g" or "°C". The caller's copy. */
  suffix?: string | undefined;
  /** Read-only and greyed. */
  disabled?: boolean | undefined;
  /** Small helper text under the field, e.g. a character count. The caller's copy. */
  hint?: string | undefined;
  /** Marks the field invalid. The message itself is the caller's. */
  invalid?: boolean | undefined;
  message?: string | undefined;
  /** The shared "Error" word (i18n `common.error`) set before the message. */
  errorPrefix?: string | undefined;
  /** Set on the bordered box. Tests only. */
  testID?: string;
};

/**
 * Text entry for notes, names and numbers (G: 54 high, 1.5 input-border edge,
 * corner 16). Focus turns the edge ink; an error turns it the error colour and
 * shows an InlineError under it.
 */
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
  icon,
  suffix,
  disabled = false,
  hint,
  invalid = false,
  message,
  errorPrefix,
  testID,
}: Props) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);
  const s = styles(theme);
  return (
    <View style={s.wrap}>
      <Text style={s.label}>{label}</Text>
      <View
        testID={testID}
        style={[
          s.box,
          multiline && s.multiline,
          focused && s.focused,
          invalid && s.invalid,
          disabled && s.disabled,
        ]}
      >
        {icon ? (
          <View style={multiline && s.multilineIcon}>
            <Icon name={icon} size={theme.size.iconField} color={theme.palette.textSoft} />
          </View>
        ) : null}
        <TextInput
          accessibilityLabel={label}
          accessibilityHint={invalid ? message : hint}
          accessibilityState={{ disabled }}
          value={value}
          onChangeText={(text) =>
            onChangeText(maxLength === undefined ? text : text.slice(0, maxLength))
          }
          editable={!disabled}
          maxLength={maxLength}
          multiline={multiline}
          keyboardType={keyboardType}
          autoComplete={autoComplete}
          textContentType={textContentType}
          autoCapitalize={autoCapitalize}
          placeholderTextColor={theme.palette.textSoft}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={[
            theme.type.body,
            s.input,
            multiline && s.multilineInput,
            disabled && s.disabledText,
          ]}
        />
        {suffix ? <Text style={[theme.type.suffix, s.suffix]}>{suffix}</Text> : null}
      </View>
      {invalid && message ? (
        <InlineError message={message} prefix={errorPrefix} />
      ) : hint ? (
        <Text style={s.hint}>{hint}</Text>
      ) : null}
    </View>
  );
}

const styles = (t: Theme) =>
  StyleSheet.create({
    wrap: { gap: t.spacing.xs },
    label: { ...t.type.small, color: t.palette.textSoft },
    box: {
      minHeight: t.size.input,
      flexDirection: 'row',
      alignItems: 'center',
      gap: t.spacing.sm,
      paddingHorizontal: t.spacing.field,
      borderRadius: t.radius.input,
      // One width in every state, so focus or an error never shifts layout.
      borderWidth: t.size.borderControl,
      borderColor: t.palette.inputBorder,
      backgroundColor: 'transparent',
    },
    multiline: {
      minHeight: t.size.inputMultiline,
      alignItems: 'flex-start',
      paddingVertical: t.spacing.field,
    },
    multilineIcon: { paddingTop: t.spacing.xs },
    focused: { borderColor: t.palette.ink },
    invalid: { borderColor: t.palette.error },
    disabled: { backgroundColor: t.palette.disabledFill, borderColor: t.palette.line },
    input: {
      flex: 1,
      alignSelf: 'stretch',
      paddingVertical: t.spacing.sm,
      color: t.palette.ink,
    },
    multilineInput: { paddingVertical: t.spacing.none, textAlignVertical: 'top' },
    disabledText: { color: t.palette.disabledText },
    suffix: { color: t.palette.textSoft },
    hint: { ...t.type.small, color: t.palette.textSoft },
  });
