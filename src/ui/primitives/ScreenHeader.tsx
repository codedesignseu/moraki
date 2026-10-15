import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { Theme } from '../theme';
import { useTheme } from '../theme';
import { IconButton } from './IconButton';

type Props = {
  title: string;
  onBack: () => void;
  /** The button's name for screen readers, e.g. "Back" or "Close". */
  backLabel: string;
  /** `back` (‹) on a pushed page, `close` (×) on a page opened over another. */
  kind?: 'back' | 'close';
  /** Something at the end of the line, e.g. a text button. */
  right?: ReactNode;
  testID?: string;
};

/**
 * The in-page header of a pushed or modal page (account/*): a round 48 back
 * or close button beside a 22 Comfortaa title. It sits at the top of the
 * page's content and keeps clear of the status bar itself, because these
 * pages draw no native header.
 */
export function ScreenHeader({ title, onBack, backLabel, kind = 'back', right, testID }: Props) {
  const theme = useTheme();
  const s = styles(theme);
  const insets = useSafeAreaInsets();
  return (
    <View style={[s.line, { paddingTop: insets.top + theme.spacing.sm }]} testID={testID}>
      <IconButton
        icon={kind}
        size="large"
        tone="card"
        onPress={onBack}
        accessibilityLabel={backLabel}
      />
      <Text accessibilityRole="header" style={[theme.type.heading, s.title]}>
        {title}
      </Text>
      {right}
    </View>
  );
}

const styles = (t: Theme) =>
  StyleSheet.create({
    line: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.md },
    title: { flex: 1 },
  });
