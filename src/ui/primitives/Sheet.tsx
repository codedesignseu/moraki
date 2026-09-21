import type { ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { Theme } from '../theme';
import { useTheme } from '../theme';

type PanelProps = {
  title?: string;
  children: ReactNode;
};

/**
 * The visible sheet surface on its own, without the modal. `Sheet` wraps it;
 * the primitives demo renders it inline so it can be seen in both themes.
 */
export function SheetPanel({ title, children }: PanelProps) {
  const theme = useTheme();
  const s = styles(theme);
  const insets = useSafeAreaInsets();
  return (
    <View style={[s.panel, { paddingBottom: theme.spacing.xl + insets.bottom }]}>
      <View style={s.grabber} accessibilityElementsHidden importantForAccessibility="no" />
      <ScrollView
        keyboardShouldPersistTaps="handled"
        style={s.scroll}
        contentContainerStyle={s.content}
        bounces={false}
      >
        {title ? (
          <Text accessibilityRole="header" style={theme.text.heading}>
            {title}
          </Text>
        ) : null}
        {children}
      </ScrollView>
    </View>
  );
}

type Props = PanelProps & {
  visible: boolean;
  onClose: () => void;
  /** Screen reader label for the dimmed area that closes the sheet, e.g. "Close". */
  closeLabel: string;
};

/**
 * Bottom sheet every log form opens in. The keyboard pushes the panel up
 * (padding on both platforms: with edge-to-edge the window never resizes),
 * and the content scrolls, so a focused input is never left under the keyboard.
 */
export function Sheet({ visible, onClose, closeLabel, title, children }: Props) {
  const s = styles(useTheme());
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
      navigationBarTranslucent
    >
      <KeyboardAvoidingView behavior="padding" style={s.fill}>
        <Pressable
          style={[s.fill, s.scrim]}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={closeLabel}
          testID="sheet-scrim"
        />
        {/* VoiceOver can't reach the scrim behind a modal view; escape (two-finger Z) closes. */}
        <View style={s.panelWrap} accessibilityViewIsModal onAccessibilityEscape={onClose}>
          <SheetPanel {...(title !== undefined && { title })}>{children}</SheetPanel>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = (t: Theme) =>
  StyleSheet.create({
    fill: { flex: 1 },
    scrim: { backgroundColor: t.colors.scrim },
    panelWrap: { maxHeight: '90%' },
    panel: {
      flexShrink: 1,
      backgroundColor: t.colors.surface,
      borderTopLeftRadius: t.radius.lg,
      borderTopRightRadius: t.radius.lg,
      paddingTop: t.spacing.sm,
      paddingHorizontal: t.spacing.xl,
    },
    grabber: {
      alignSelf: 'center',
      width: t.size.touchTarget,
      height: t.spacing.xs,
      borderRadius: t.radius.pill,
      backgroundColor: t.colors.divider,
      marginBottom: t.spacing.md,
    },
    scroll: { flexGrow: 0, flexShrink: 1 },
    content: { gap: t.spacing.lg, paddingTop: t.spacing.sm },
  });
