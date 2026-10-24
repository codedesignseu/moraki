import { StyleSheet, View } from 'react-native';

import type { Theme } from '../theme';
import { useTheme } from '../theme';

export type ChartPoint = {
  key: string;
  x: number;
  y: number;
  /** Read by screen readers for this point, e.g. "Day 10: 3300 g". */
  accessibilityLabel: string;
  /** An outlined point (G: weighed at home); filled by default (at the clinic). Pair with a Legend. */
  hollow?: boolean;
};

type Props = {
  points: readonly ChartPoint[];
  /** Ends of the x axis, already decided by the caller. */
  xRange: { min: number; max: number };
  testID?: string;
};

const span = (min: number, max: number) => (max - min === 0 ? 1 : max - min);

/** G draws three even gridlines: top, middle and bottom of the plot. */
const GRIDLINES = [0, 0.5, 1] as const;

/**
 * G point chart (tabs/trends weight): points on three soft gridlines, filled
 * or hollow by where they were measured, all in ink: a chart shows what was
 * measured, never a verdict on it (rule 10). No reference line, no marked
 * day, no coloured axis, no shaded region (P0.7): nothing here knows what the
 * numbers mean.
 */
export function PointChart({ points, xRange, testID }: Props) {
  const theme = useTheme();
  const s = styles(theme);

  const values = points.map((p) => p.y);
  const low = values.length > 0 ? Math.min(...values) : 0;
  const high = values.length > 0 ? Math.max(...values) : 1;
  // A little room above and below, so a point never sits on the edge.
  const padding = span(low, high) * 0.1;
  const bottom = low - padding;
  const top = high + padding;

  const percent = (fraction: number): `${number}%` => `${fraction * 100}%`;
  const atY = (y: number) => percent((top - y) / span(bottom, top));
  const atX = (x: number) => percent((x - xRange.min) / span(xRange.min, xRange.max));

  return (
    <View style={s.chart} testID={testID}>
      <View style={s.plot}>
        {GRIDLINES.map((at) => (
          <View key={at} style={[s.grid, { top: percent(at) }]} testID="gridline" />
        ))}
        {points.map((point) => (
          <View
            key={point.key}
            accessible
            accessibilityLabel={point.accessibilityLabel}
            testID={`point-${point.key}`}
            style={[s.point, point.hollow && s.hollow, { left: atX(point.x), top: atY(point.y) }]}
          />
        ))}
      </View>
    </View>
  );
}

const styles = (t: Theme) =>
  StyleSheet.create({
    chart: { gap: t.spacing.xs },
    plot: { height: t.size.chartHeight },
    grid: {
      position: 'absolute',
      left: 0,
      right: 0,
      height: t.size.borderThin,
      backgroundColor: t.palette.line,
    },
    point: {
      position: 'absolute',
      width: t.size.point,
      height: t.size.point,
      marginLeft: -t.size.point / 2,
      marginTop: -t.size.point / 2,
      borderRadius: t.radius.pill,
      backgroundColor: t.palette.ink,
    },
    hollow: {
      backgroundColor: t.palette.card,
      borderWidth: t.size.legendRing,
      borderColor: t.palette.ink,
    },
  });
