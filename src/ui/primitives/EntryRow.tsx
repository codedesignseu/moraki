import { StyleSheet, Text, View } from 'react-native';

import type { Theme } from '../theme';
import { useTheme } from '../theme';

type Props = {
  title: string;
  detail?: string | undefined;
  /** Right-hand lines, e.g. the time and who logged it. */
  meta: readonly string[];
  testID?: string;
};

/** A logged entry in a list: what it was on the left, when and by whom on the right. */
export function EntryRow({ title, detail, meta, testID }: Props) {
  const theme = useTheme();
  const s = styles(theme);
  return (
    <View style={s.row} testID={testID} accessible>
      <View style={s.main}>
        <Text style={theme.text.bodyStrong}>{title}</Text>
        {detail ? <Text style={theme.text.body}>{detail}</Text> : null}
      </View>
      <View style={s.meta}>
        {meta.map((line, i) => (
          <Text key={i} style={s.muted}>
            {line}
          </Text>
        ))}
      </View>
    </View>
  );
}

const styles = (t: Theme) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: t.spacing.md,
      paddingVertical: t.spacing.sm,
      borderTopWidth: t.size.borderThin,
      borderTopColor: t.colors.divider,
    },
    main: { flex: 1 },
    meta: { alignItems: 'flex-end' },
    muted: { ...t.text.label, color: t.colors.textMuted },
  });
