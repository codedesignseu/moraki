import { StyleSheet, Text, View } from 'react-native';

import type { Theme } from '../theme';
import { useTheme } from '../theme';

export type Bar = {
  key: string;
  /** Under the bar, e.g. "Mon" or "Today". */
  label: string;
  value: number;
  /** Above the bar, already formatted, e.g. "600" or "95". */
  valueLabel: string;
  /** Read by screen readers for the whole bar, e.g. "Monday: 600 ml". */
  accessibilityLabel: string;
  /** Marks one bar, such as today, with a bold label. */
  current?: boolean;
};

type Props = {
  bars: readonly Bar[];
  /** The series colour (G tabs/trends: bottle in `chartFeed`, breast in `chartSleep`). */
  colour?: 'chartFeed' | 'chartSleep';
  testID?: string;
};

/**
 * G bars (tabs/trends): full width, round corners, the value above and the
 * day below, scaled to the largest value. One colour per series and never a
 * colour per value: a chart shows amounts, not a judgement of them (rule 10).
 * Each bar is one accessible element with its own label.
 */
export function BarChart({ bars, colour = 'chartFeed', testID }: Props) {
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
                {
                  height: max === 0 ? 0 : (bar.value / max) * theme.size.chartHeight,
                  backgroundColor: theme.palette[colour],
                },
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
    chart: { flexDirection: 'row', gap: t.spacing.sm },
    column: { flex: 1, alignItems: 'center', gap: t.spacing.xs },
    value: { ...t.type.tileDetail, color: t.palette.textSoft },
    plot: { height: t.size.chartHeight, alignSelf: 'stretch', justifyContent: 'flex-end' },
    fill: { borderRadius: t.radius.bar },
    label: { ...t.type.tileDetail, color: t.palette.ink },
    // Today's label in bold, so it reads by weight as well as by word.
    current: t.type.statLabel,
  });
