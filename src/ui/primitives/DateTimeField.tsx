import { useState } from 'react';
import DateTimePicker, {
  DateTimePickerAndroid,
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import type { Theme } from '../theme';
import { useTheme } from '../theme';
import { Icon } from './Icon';

type Props = {
  /** Names the field for a screen reader, e.g. "Feed time". */
  label: string;
  /** The moment being set, in epoch milliseconds. */
  value: number;
  onChange: (at: number) => void;
  /** Already formatted by the caller: this primitive knows no locale. */
  display: string;
  /** What pressing the field does, e.g. "Set exact time". Read as its hint. */
  openLabel: string;
  /** Nothing later than this can be chosen, e.g. now for something logged. */
  maximumDate?: Date | undefined;
  minimumDate?: Date | undefined;
  /** Draws the edge in the error colour (G sheets/sleep-idle "End"). The message is the caller's. */
  invalid?: boolean;
  testID?: string;
};

/**
 * The platform's own date and time picker, behind one prop shape.
 *
 * G draws it as a text field (sheets/feed-bottle "Time", sheets/weight
 * "Date"): 54 high, a clock icon and the value. The whole field is the button
 * that opens the picker.
 *
 * Android opens date then time, as its guidelines ask; iOS shows one inline
 * picker. Neither does any date arithmetic here: the caller passes the moment
 * and the words for it, and gets a moment back (rule 3 keeps the maths in
 * domain, rule 9 keeps the words in i18n).
 */
export function DateTimeField({
  label,
  value,
  onChange,
  display,
  openLabel,
  maximumDate,
  minimumDate,
  invalid = false,
  testID,
}: Props) {
  const theme = useTheme();
  const s = styles(theme);
  const [showing, setShowing] = useState(false);

  /** Keeps the date from one step and the time from the next. */
  const combine = (date: Date, time: Date) => {
    const at = new Date(date);
    at.setHours(time.getHours(), time.getMinutes(), 0, 0);
    return at.getTime();
  };

  const openOnAndroid = () => {
    DateTimePickerAndroid.open({
      value: new Date(value),
      mode: 'date',
      ...(maximumDate && { maximumDate }),
      ...(minimumDate && { minimumDate }),
      onChange: (_event: DateTimePickerEvent, picked?: Date) => {
        if (!picked) return;
        DateTimePickerAndroid.open({
          value: new Date(value),
          mode: 'time',
          onChange: (_timeEvent: DateTimePickerEvent, time?: Date) => {
            if (time) onChange(combine(picked, time));
          },
        });
      },
    });
  };

  return (
    <View style={s.field} testID={testID}>
      <Text style={s.label}>{label}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityHint={openLabel}
        accessibilityValue={{ text: display }}
        accessibilityState={{ expanded: Platform.OS === 'android' ? undefined : showing }}
        onPress={() => (Platform.OS === 'android' ? openOnAndroid() : setShowing((was) => !was))}
        style={({ pressed }) => [s.box, (pressed || showing) && s.active, invalid && s.invalid]}
      >
        <Icon name="time" size={theme.size.iconField} color={theme.palette.textSoft} />
        <Text style={[theme.type.body, s.value]} testID={testID ? `${testID}-value` : undefined}>
          {display}
        </Text>
      </Pressable>
      {showing && Platform.OS !== 'android' && (
        <DateTimePicker
          testID={testID ? `${testID}-picker` : undefined}
          value={new Date(value)}
          mode="datetime"
          display="spinner"
          // iOS draws the wheel with its own colours, which on the light
          // palette came out almost white on cream — legible in dark mode
          // and invisible in light. Both are told explicitly.
          themeVariant={theme.scheme === 'night' ? 'dark' : 'light'}
          textColor={theme.palette.ink}
          {...(maximumDate && { maximumDate })}
          {...(minimumDate && { minimumDate })}
          onChange={(_event: DateTimePickerEvent, picked?: Date) => {
            if (picked) onChange(picked.getTime());
          }}
        />
      )}
    </View>
  );
}

const styles = (t: Theme) =>
  StyleSheet.create({
    field: { gap: t.spacing.xs },
    label: { ...t.type.small, color: t.palette.textSoft },
    box: {
      minHeight: t.size.input,
      flexDirection: 'row',
      alignItems: 'center',
      gap: t.spacing.sm,
      paddingHorizontal: t.spacing.field,
      paddingVertical: t.spacing.sm,
      borderRadius: t.radius.input,
      borderWidth: t.size.borderControl,
      borderColor: t.palette.inputBorder,
    },
    // Pressed, or open on iOS: the edge turns ink, like a focused text field.
    active: { borderColor: t.palette.ink },
    invalid: { borderColor: t.palette.error },
    value: { flex: 1 },
  });
