import { StyleSheet, Text, View } from 'react-native';

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

export type ChartLine = {
  key: string;
  y: number;
  /** Sits at the end of the line, e.g. "90%". */
  label: string;
};

export type ChartMark = {
  key: string;
  x: number;
  /** Under the mark, e.g. "Day 10". */
  label: string;
};

type Props = {
  points: readonly ChartPoint[];
  /** Horizontal reference lines, drawn the same weight as each other. */
  lines?: readonly ChartLine[];
  /** Vertical marks at days worth looking at. */
  marks?: readonly ChartMark[];
  /** Ends of the x axis, already decided by the caller. */
  xRange: { min: number; max: number };
  testID?: string;
};

const span = (min: number, max: number) => (max - min === 0 ? 1 : max - min);

/** G draws three even gridlines: top, middle and bottom of the plot. */
const GRIDLINES = [0, 0.5, 1] as const;

/**
 * G point chart (tabs/trends weight): points on three soft gridlines, filled
 * or hollow by where they were measured, against reference lines, all in
 * ink: a chart shows what was measured, never a verdict on it (rule 10). No
 * axis is coloured, no region is shaded, and nothing here knows what the
 * numbers mean.
 */
export function PointChart({ points, lines = [], marks = [], xRange, testID }: Props) {
  const theme = useTheme();
  const s = styles(theme);

  const values = [...points.map((p) => p.y), ...lines.map((l) => l.y)];
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
        {lines.map((line) => (
          <View key={line.key} style={[s.line, { top: atY(line.y) }]} testID={`line-${line.key}`}>
            <View style={s.rule} />
            <Text style={s.lineLabel}>{line.label}</Text>
          </View>
        ))}
        {marks.map((mark) => (
          <View
            key={mark.key}
            style={[s.mark, { left: atX(mark.x) }]}
            testID={`mark-${mark.key}`}
          />
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
      <View style={s.axis}>
        {marks.map((mark) => (
          <Text key={mark.key} style={[s.markLabel, { left: atX(mark.x) }]}>
            {mark.label}
          </Text>
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
    line: { position: 'absolute', left: 0, right: 0, flexDirection: 'row', alignItems: 'center' },
    // Reference lines are darker than the gridlines, so they read as lines to compare against.
    rule: { flex: 1, height: t.size.borderThin, backgroundColor: t.palette.outline },
    lineLabel: { ...t.type.tileDetail, color: t.palette.textSoft, paddingLeft: t.spacing.xs },
    mark: {
      position: 'absolute',
      top: 0,
      bottom: 0,
      width: t.size.borderThin,
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
    axis: { height: t.type.tileDetail.lineHeight },
    markLabel: { ...t.type.tileDetail, color: t.palette.textSoft, position: 'absolute' },
  });
