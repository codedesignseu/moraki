import { StyleSheet, Text, View } from 'react-native';

import type { Theme } from '../theme';
import { useTheme } from '../theme';
import { Stepper } from './Stepper';

/** Five-minute steps, up to a day either way. */
export const TIME_SHIFT = { step: 5, min: -24 * 60, max: 24 * 60 } as const;

type Props = {
  /** Names the control, e.g. "Move time". */
  label: string;
  /** Minutes earlier (negative) or later (positive) than the entry's time. */
  minutes: number;
  onChange: (minutes: number) => void;
  unit: string;
  /** The resulting time, already formatted, e.g. "New time: Fri 23 Oct, 13:50". */
  result: string;
  /** Latest allowed shift in minutes, e.g. so a running sleep can't start in the future. */
  max?: number | undefined;
};

/** Moves an entry's time earlier or later without a date picker. */
export function TimeShiftField({ label, minutes, onChange, unit, result, max }: Props) {
  const theme = useTheme();
  const s = styles(theme);
  return (
    <View style={s.wrap}>
      <Text style={s.label}>{label}</Text>
      <Stepper
        value={minutes}
        onChange={onChange}
        step={TIME_SHIFT.step}
        min={TIME_SHIFT.min}
        max={Math.min(max ?? TIME_SHIFT.max, TIME_SHIFT.max)}
        unit={unit}
        accessibilityLabel={label}
      />
      <Text style={theme.text.body}>{result}</Text>
    </View>
  );
}

const styles = (t: Theme) =>
  StyleSheet.create({
    wrap: { gap: t.spacing.xs },
    label: { ...t.text.label, color: t.colors.textMuted },
  });
