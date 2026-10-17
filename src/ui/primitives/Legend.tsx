import { StyleSheet, Text, View } from 'react-native';

import type { Theme } from '../theme';
import { useTheme } from '../theme';
import type { PaletteName } from '../tokens';

export type LegendItem = {
  label: string;
  /** `filled` (default) or `hollow`, matching the chart's mark. */
  shape?: 'filled' | 'hollow';
  /** The mark's colour; ink by default. */
  colour?: PaletteName;
};

type Props = {
  items: readonly LegendItem[];
  testID?: string;
};

/** What each mark on a chart means (G: tabs/trends weight card: Clinic, Home). */
export function Legend({ items, testID }: Props) {
  const theme = useTheme();
  const s = styles(theme);
  return (
    <View style={s.row} testID={testID}>
      {items.map((item) => {
        const colour = theme.palette[item.colour ?? 'ink'];
        return (
          <View key={item.label} style={s.item}>
            <View
              testID="legend-dot"
              style={[
                s.dot,
                item.shape === 'hollow'
                  ? { borderWidth: theme.size.legendRing, borderColor: colour }
                  : { backgroundColor: colour },
              ]}
            />
            <Text style={[theme.type.small, s.label]}>{item.label}</Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = (t: Theme) =>
  StyleSheet.create({
    row: { flexDirection: 'row', flexWrap: 'wrap', columnGap: t.spacing.lg, rowGap: t.spacing.xs },
    item: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.xs },
    dot: { width: t.size.legendDot, height: t.size.legendDot, borderRadius: t.radius.pill },
    label: { color: t.palette.textSoft },
  });
