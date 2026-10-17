import { StyleSheet, Text, View } from 'react-native';

import type { Theme } from '../theme';
import { useTheme } from '../theme';
import { Icon } from './Icon';

type Props = {
  /** What is wrong and how to fix it. The caller's copy. */
  message: string;
  /**
   * The shared "Error" word (i18n `common.error`), set before the message as
   * "Error: …", so the message never relies on colour alone.
   */
  prefix?: string | undefined;
  testID?: string;
};

/**
 * A form error under the control it is about (G: sheets/feed-error,
 * sheets/weight): alert icon, then the message in the error colour.
 * Announced as an alert when it appears.
 */
export function InlineError({ message, prefix, testID }: Props) {
  const theme = useTheme();
  const s = styles(theme);
  return (
    <View accessible accessibilityRole="alert" testID={testID} style={s.row}>
      <View style={s.icon}>
        <Icon name="alert" size={theme.size.iconError} color={theme.palette.error} />
      </View>
      <Text style={[theme.type.detail, s.text]}>{prefix ? `${prefix}: ${message}` : message}</Text>
    </View>
  );
}

const styles = (t: Theme) =>
  StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'flex-start', gap: t.spacing.xs },
    // Sits the icon on the first line of text as the text grows.
    icon: {
      minHeight: t.type.detail.lineHeight,
      justifyContent: 'center',
    },
    text: { flex: 1, color: t.palette.error },
  });
