import { StyleSheet, Text, View } from 'react-native';

import type { Theme } from '../theme';
import { useTheme } from '../theme';

export type ChartPoint = {
  key: string;
  x: number;
  y: number;
  /** Read by screen readers for this point, e.g. "Day 10: 3300 g". */
  accessibilityLabel: string;
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

/**
 * Points against reference lines, in one colour: a chart shows what was
 * measured, never a verdict on it (rule 10). No axis is coloured, no region
 * is shaded, and nothing here knows what the numbers mean.
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
            style={[s.point, { left: atX(point.x), top: atY(point.y) }]}
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
    plot: {
      height: t.size.chartHeight,
      borderBottomWidth: t.size.borderThin,
      borderBottomColor: t.colors.borderStrong,
      borderLeftWidth: t.size.borderThin,
      borderLeftColor: t.colors.borderStrong,
    },
    line: { position: 'absolute', left: 0, right: 0, flexDirection: 'row', alignItems: 'center' },
    rule: {
      flex: 1,
      height: t.size.borderThin,
      backgroundColor: t.colors.divider,
    },
    lineLabel: { ...t.text.caption, color: t.colors.textMuted, paddingLeft: t.spacing.xs },
    mark: {
      position: 'absolute',
      top: 0,
      bottom: 0,
      width: t.size.borderThin,
      backgroundColor: t.colors.divider,
    },
    point: {
      position: 'absolute',
      width: t.size.point,
      height: t.size.point,
      marginLeft: -t.size.point / 2,
      marginTop: -t.size.point / 2,
      borderRadius: t.size.point / 2,
      backgroundColor: t.colors.accent,
    },
    axis: { height: t.text.caption.lineHeight },
    markLabel: { ...t.text.caption, color: t.colors.textMuted, position: 'absolute' },
  });
