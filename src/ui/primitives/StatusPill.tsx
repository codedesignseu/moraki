import { StyleSheet, Text, View } from 'react-native';

import type { Theme } from '../theme';
import { useTheme } from '../theme';

type Props = {
  label: string;
  /** Marks something running, like a timer. The label says so too. */
  live?: boolean;
  testID?: string;
};

/** Sage status pill, e.g. "Now · 05:14" at the top of a log sheet. */
export function StatusPill({ label, live = false, testID }: Props) {
  const theme = useTheme();
  const s = styles(theme);
  return (
    <View style={s.pill} testID={testID}>
      {live ? <View style={s.dot} /> : null}
      <Text style={[theme.type.detail, s.label]}>{label}</Text>
    </View>
  );
}

const styles = (t: Theme) =>
  StyleSheet.create({
    pill: {
      alignSelf: 'flex-start',
      minHeight: t.size.pill,
      flexDirection: 'row',
      alignItems: 'center',
      gap: t.spacing.sm,
      paddingHorizontal: t.spacing.lg,
      borderRadius: t.radius.pill,
      backgroundColor: t.palette.card,
    },
    dot: {
      width: t.size.dot,
      height: t.size.dot,
      borderRadius: t.radius.pill,
      backgroundColor: t.palette.ink,
    },
    label: { color: t.palette.ink },
  });
