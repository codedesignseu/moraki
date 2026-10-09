import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { Theme } from '../theme';
import { useTheme } from '../theme';

type Props = {
  message: string;
  actionLabel: string;
  onAction: () => void;
};

/** A short confirmation along the bottom of the screen with one action, e.g. Undo. */
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
      bottom: t.size.tabBar + t.size.tabBarBottomOffset + t.spacing.md,
      alignItems: 'center',
      paddingHorizontal: t.spacing.lg,
    },
    toast: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: t.spacing.md,
      alignSelf: 'stretch',
      minHeight: t.size.touchTargetLarge,
      paddingVertical: t.spacing.sm,
      paddingLeft: t.spacing.xl,
      paddingRight: t.spacing.sm,
      borderRadius: t.radius.pill,
      backgroundColor: t.palette.tabBar,
    },
    message: { ...t.type.rowTitle, color: t.palette.onTabBar, flex: 1 },
    action: {
      minHeight: t.size.touchTarget,
      minWidth: t.size.touchTarget,
      justifyContent: 'center',
      paddingHorizontal: t.spacing.lg,
      borderRadius: t.radius.pill,
      backgroundColor: t.palette.tabActive,
    },
    pressed: { opacity: t.opacity.pressed },
    actionText: { ...t.type.rowTitle, color: t.palette.onTabActive },
  });
