import { StyleSheet, Text, View } from 'react-native';

import type { Theme } from '../theme';
import { useTheme } from '../theme';

type Props = {
  label: string;
  /** Marks something running, like a timer. The label says so too. */
  live?: boolean;
  testID?: string;
};

/**
 * Status pill, e.g. "At 05:14" under a log sheet's time field. G sheets are on
 * the card colour, so the pill takes the chip fill to show against it.
 */
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
      backgroundColor: t.palette.chip,
    },
    dot: {
      width: t.size.dot,
      height: t.size.dot,
      borderRadius: t.radius.pill,
      backgroundColor: t.palette.ink,
    },
    label: { color: t.palette.ink },
  });
