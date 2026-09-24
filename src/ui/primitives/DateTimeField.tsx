import { useState } from 'react';
import DateTimePicker, {
  DateTimePickerAndroid,
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { Platform, StyleSheet, Text, View } from 'react-native';

import type { Theme } from '../theme';
import { useTheme } from '../theme';
import { Button } from './Button';

type Props = {
  /** Names the field for a screen reader, e.g. "Feed time". */
  label: string;
  /** The moment being set, in epoch milliseconds. */
  value: number;
  onChange: (at: number) => void;
  /** Already formatted by the caller: this primitive knows no locale. */
  display: string;
  /** The button that opens the picker, e.g. "Set exact time". */
  openLabel: string;
  /** Nothing later than this can be chosen, e.g. now for something logged. */
  maximumDate?: Date | undefined;
  minimumDate?: Date | undefined;
  testID?: string;
};

/**
 * The platform's own date and time picker, behind one prop shape.
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
      <Text style={theme.text.title} testID={testID ? `${testID}-value` : undefined}>
        {display}
      </Text>
      <Button
        label={openLabel}
        variant="secondary"
        accessibilityLabel={label}
        onPress={() => (Platform.OS === 'android' ? openOnAndroid() : setShowing((was) => !was))}
      />
      {showing && Platform.OS !== 'android' && (
        <DateTimePicker
          value={new Date(value)}
          mode="datetime"
          display="spinner"
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
    label: { ...t.text.label, color: t.colors.textMuted },
  });
