import { StyleSheet, Text, View } from 'react-native';

import type { Theme } from '../theme';
import { useTheme } from '../theme';
import type { CircleTone } from './IconCircle';

type Props = {
  /** Already formatted by the caller, e.g. "6" or "240 ml". */
  value: string;
  label: string;
  tone?: CircleTone;
  /**
   * `valueFirst` (default): a centred number over its label, as Home's Today
   * row. `labelFirst`: the label over a larger number, left-aligned, as the
   * milk stock cells.
   */
  layout?: 'valueFirst' | 'labelFirst';
  /** Defaults to the value and label read together. */
  accessibilityLabel?: string;
  testID?: string;
};

/** A tinted cell with one number and what it counts (G: tabs/home). No interpretation. */
export function StatCell({
  value,
  label,
  tone = 'chip',
  layout = 'valueFirst',
  accessibilityLabel,
  testID,
}: Props) {
  const theme = useTheme();
  const s = styles(theme);
  const labelFirst = layout === 'labelFirst';
  const number = (
    <Text style={[labelFirst ? theme.type.heading : theme.type.sheetTitle, s.value]}>{value}</Text>
  );
  const caption = <Text style={[theme.type.statLabel, s.label]}>{label}</Text>;
  return (
    <View
      accessible
      accessibilityLabel={
        accessibilityLabel ?? (labelFirst ? `${label}, ${value}` : `${value} ${label}`)
      }
      testID={testID}
      style={[
        s.cell,
        labelFirst ? s.labelFirst : s.valueFirst,
        { backgroundColor: theme.palette[tone] },
      ]}
    >
      {labelFirst ? caption : number}
      {labelFirst ? number : caption}
    </View>
  );
}

const styles = (t: Theme) =>
  StyleSheet.create({
    cell: { flex: 1, borderRadius: t.radius.stat },
    valueFirst: {
      alignItems: 'center',
      paddingVertical: t.spacing.md,
      paddingHorizontal: t.spacing.xs,
    },
    labelFirst: { paddingVertical: t.spacing.md, paddingHorizontal: t.spacing.field },
    value: { fontVariant: ['tabular-nums'], textAlign: 'center' },
    label: { color: t.palette.textSoft, textAlign: 'center' },
  });
