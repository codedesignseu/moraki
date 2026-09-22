import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { Theme } from '../theme';
import { useTheme } from '../theme';

type Props = {
  text: string;
  testID?: string;
};

/** A persistent one-line strip across the top of the app. Informational, never a health signal. */
export function Notice({ text, testID }: Props) {
  const theme = useTheme();
  const s = styles(theme);
  const insets = useSafeAreaInsets();
  return (
    <View
      style={[s.strip, { paddingTop: theme.spacing.sm + insets.top }]}
      accessible
      accessibilityRole="alert"
      testID={testID}
    >
      <Text style={s.text}>{text}</Text>
    </View>
  );
}

const styles = (t: Theme) =>
  StyleSheet.create({
    strip: {
      backgroundColor: t.colors.accentSubtle,
      paddingHorizontal: t.spacing.lg,
      paddingBottom: t.spacing.sm,
    },
    text: { ...t.text.label, color: t.colors.text },
  });
