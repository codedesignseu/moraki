import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { IconName } from '@/ui/icons';
import { Card, IconCircle } from '@/ui/primitives';
import { useTheme, type Theme } from '@/ui/theme';

/**
 * A G settings card (tabs/settings): a 40 chip-coloured badge and the
 * Comfortaa 17 title, then the card's content.
 */
export function SettingsCard({
  icon,
  title,
  testID,
  children,
}: {
  icon: IconName;
  title: string;
  testID: string;
  children: ReactNode;
}) {
  const theme = useTheme();
  const s = styles(theme);
  return (
    <Card testID={testID}>
      <View style={s.titleRow}>
        <IconCircle icon={icon} tone="chip" />
        <Text accessibilityRole="header" style={[theme.type.cardTitle, s.title]}>
          {title}
        </Text>
      </View>
      {children}
    </Card>
  );
}

/**
 * A label and its value on one 52 row with a hairline under it ("Email",
 * "Consent"). Screen readers hear `accessibilityLabel` as one line.
 */
export function ValueRow({
  label,
  value,
  accessibilityLabel,
  testID,
}: {
  label: string;
  value: string;
  accessibilityLabel: string;
  testID?: string;
}) {
  const theme = useTheme();
  const s = styles(theme);
  return (
    <View style={s.valueRow} accessible accessibilityLabel={accessibilityLabel} testID={testID}>
      <Text style={[theme.type.detail, s.soft]}>{label}</Text>
      <Text style={[theme.type.figureRow, s.value]}>{value}</Text>
    </View>
  );
}

const styles = (theme: Theme) =>
  StyleSheet.create({
    titleRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md },
    title: { flex: 1, color: theme.palette.ink },
    valueRow: {
      minHeight: theme.size.valueRow,
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      justifyContent: 'space-between',
      columnGap: theme.spacing.md,
      borderBottomWidth: theme.size.borderThin,
      borderBottomColor: theme.palette.line,
    },
    soft: { color: theme.palette.textSoft },
    value: { flexShrink: 1, textAlign: 'right', color: theme.palette.ink },
  });
