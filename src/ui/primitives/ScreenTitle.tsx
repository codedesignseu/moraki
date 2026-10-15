import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { Theme } from '../theme';
import { useTheme } from '../theme';

type Props = {
  title: string;
  /** A soft line under the title, e.g. "Last 7 days" (tabs/trends). */
  subtitle?: string;
  /** Something at the end of the title line, e.g. a button. */
  right?: ReactNode;
  testID?: string;
};

/**
 * A tab's title, drawn in its content (tabs/history, trends, settings): 30
 * Comfortaa, 12 below the safe area, so about 58 from the top of a phone
 * with a notch. The tabs have no native header; the tab scene keeps its
 * content below the status bar.
 */
export function ScreenTitle({ title, subtitle, right, testID }: Props) {
  const theme = useTheme();
  const s = styles(theme);
  return (
    <View style={s.wrap} testID={testID}>
      <View style={s.line}>
        <Text accessibilityRole="header" style={[theme.type.title, s.title]}>
          {title}
        </Text>
        {right}
      </View>
      {subtitle ? <Text style={s.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = (t: Theme) =>
  StyleSheet.create({
    wrap: { paddingTop: t.spacing.md, gap: t.spacing.md },
    line: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.md },
    title: { flex: 1 },
    subtitle: { ...t.type.rowLabel, color: t.palette.textSoft },
  });
