import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { Theme } from '../theme';
import { useTheme } from '../theme';

type Props = {
  message: string;
  actionLabel: string;
  onAction: () => void;
};

/**
 * A short confirmation along the bottom of the screen with one action, e.g.
 * Undo (G: foundations). Its own tokens: an ink pill with a butter Undo pill
 * by day, reversed at night. The Undo pill is 48 high (G draws 44).
 */
export function Toast({ message, actionLabel, onAction }: Props) {
  const theme = useTheme();
  const s = styles(theme);
  return (
    <View style={s.wrap} pointerEvents="box-none">
      <View style={s.toast}>
        {/* The message is announced; Undo stays its own button for screen readers. */}
        <Text style={s.message} accessibilityRole="alert" accessibilityLiveRegion="polite">
          {message}
        </Text>
        <Pressable
          onPress={onAction}
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
          style={({ pressed }) => [s.action, pressed && s.pressed]}
        >
          <Text style={s.actionText}>{actionLabel}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = (t: Theme) =>
  StyleSheet.create({
    wrap: {
      position: 'absolute',
      left: 0,
      right: 0,
      // Clear of the floating tab bar.
      bottom: t.size.navBar + t.size.navBottom + t.spacing.md,
      alignItems: 'center',
      paddingHorizontal: t.spacing.screenEdge,
    },
    toast: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: t.spacing.md,
      alignSelf: 'stretch',
      minHeight: t.size.toast,
      paddingVertical: t.spacing.xs,
      paddingLeft: t.spacing.pill,
      paddingRight: t.spacing.xs,
      borderRadius: t.radius.pill,
      backgroundColor: t.palette.toast,
    },
    message: { ...t.type.lead, color: t.palette.onToast, flex: 1 },
    action: {
      minHeight: t.size.minTouch,
      minWidth: t.size.minTouch,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: t.spacing.screenEdge,
      borderRadius: t.radius.pill,
      backgroundColor: t.palette.undo,
    },
    pressed: { opacity: t.opacity.pressed },
    actionText: { ...t.type.detailBold, color: t.palette.onUndo },
  });
