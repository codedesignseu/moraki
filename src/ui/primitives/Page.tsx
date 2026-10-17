import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { Theme } from '../theme';
import { useTheme } from '../theme';
import { ScreenHeader } from './ScreenHeader';

type Props = {
  title: string;
  onBack: () => void;
  /** The header button's name for screen readers ("Back", "Close"). */
  backLabel: string;
  /** `close` (×) on a page opened over another, `back` (‹) on a pushed one. */
  kind?: 'back' | 'close';
  children: ReactNode;
  /**
   * The page's main button, at the foot (G pins it 34 above the bottom edge).
   * It sits at the end of the scrolling content, pushed down to the bottom
   * while the content is short, so the keyboard and 200% text never hide it.
   */
  footer?: ReactNode;
  testID?: string;
};

/**
 * An account page (G account/*): the in-page header, then the content at the
 * screen edge in one scrolling column, then the optional footer button.
 */
export function Page({ title, onBack, backLabel, kind = 'back', children, footer, testID }: Props) {
  const theme = useTheme();
  const s = styles(theme);
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      testID={testID}
      style={s.page}
      contentContainerStyle={[
        s.content,
        { paddingBottom: Math.max(insets.bottom, theme.spacing.xl) },
      ]}
      keyboardShouldPersistTaps="handled"
      automaticallyAdjustKeyboardInsets
    >
      <ScreenHeader title={title} onBack={onBack} backLabel={backLabel} kind={kind} />
      {children}
      {footer ? <View style={s.footer}>{footer}</View> : null}
    </ScrollView>
  );
}

const styles = (t: Theme) =>
  StyleSheet.create({
    page: { backgroundColor: t.palette.background },
    content: { flexGrow: 1, paddingHorizontal: t.spacing.screenEdge, gap: t.spacing.lg },
    footer: { marginTop: 'auto', gap: t.spacing.xs },
  });
