import { StyleSheet, Text, View } from 'react-native';

import type { Theme } from '../theme';
import { useTheme } from '../theme';

export type Bar = {
  key: string;
  /** Under the bar, e.g. "Mon" or "Today". */
  label: string;
  value: number;
  /** Above the bar, already formatted, e.g. "600" or "1h 30m". */
  valueLabel: string;
  /** Read by screen readers for the whole bar, e.g. "Monday: 600 mL". */
  accessibilityLabel: string;
  /** Marks one bar, such as today, with a bold label. */
  current?: boolean;
};

type Props = {
  bars: readonly Bar[];
  testID?: string;
};

/**
 * Vertical bars scaled to the largest value, in the accent colour only: a
 * chart shows amounts, never a judgement of them (rule 10). Each bar is one
 * accessible element with its own label.
 */
export function BarChart({ bars, testID }: Props) {
  const theme = useTheme();
  const s = styles(theme);
  const max = Math.max(0, ...bars.map((bar) => bar.value));
  return (
    <View style={s.chart} testID={testID}>
      {bars.map((bar) => (
        <View
          key={bar.key}
          style={s.column}
          accessible
          accessibilityLabel={bar.accessibilityLabel}
          testID={`bar-${bar.key}`}
        >
          <Text style={s.value}>{bar.valueLabel}</Text>
          <View style={s.plot}>
            <View
              testID={`bar-${bar.key}-fill`}
              style={[
                s.fill,
                { height: max === 0 ? 0 : (bar.value / max) * theme.size.chartHeight },
              ]}
            />
          </View>
          <Text style={[s.label, bar.current && s.current]}>{bar.label}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = (t: Theme) =>
  StyleSheet.create({
    chart: { flexDirection: 'row', gap: t.spacing.xs },
    column: { flex: 1, alignItems: 'center', gap: t.spacing.xs },
    value: { ...t.text.caption, color: t.colors.textMuted },
    plot: {
      height: t.size.chartHeight,
      alignSelf: 'stretch',
      justifyContent: 'flex-end',
      borderBottomWidth: t.size.borderThin,
      borderBottomColor: t.colors.borderStrong,
    },
    fill: {
      backgroundColor: t.colors.accent,
      borderTopLeftRadius: t.radius.sm,
      borderTopRightRadius: t.radius.sm,
    },
    label: { ...t.text.caption, color: t.colors.textMuted },
    current: { color: t.colors.text, fontWeight: t.text.bodyStrong.fontWeight },
  });
