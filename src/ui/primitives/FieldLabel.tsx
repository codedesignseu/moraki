import { StyleSheet, Text } from 'react-native';

import type { Theme } from '../theme';
import { useTheme } from '../theme';

type Props = { label: string };

/**
 * The small label above a sheet's control (G: sheets/feed-bottle "Amount",
 * "Milk"): 13/600 in the soft colour. The control below carries the same name
 * for screen readers, so the label itself is hidden from them.
 */
export function FieldLabel({ label }: Props) {
  const theme = useTheme();
  const s = styles(theme);
  return (
    <Text
      style={s.label}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {label}
    </Text>
  );
}

const styles = (t: Theme) =>
  StyleSheet.create({
    label: { ...t.type.small, color: t.palette.textSoft },
  });
