import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { IconName } from '../icons';
import type { Theme } from '../theme';
import { useTheme } from '../theme';
import { Icon } from './Icon';

export type TabBarItem = {
  key: string;
  /** Read by screen readers; the bar shows icons only, as the design does. */
  label: string;
  icon: IconName;
  selected: boolean;
  onPress: () => void;
  onLongPress?: () => void;
};

type Props = {
  items: readonly TabBarItem[];
  testID?: string;
};

/**
 * G floating tab bar (every tabs/* file): a pill of round 52 buttons, gap 8,
 * padding 8, centred 30 above the bottom edge, or above the system's own bar
 * when that is taller. The active button is dark by day and light at night,
 * so it differs from the others in fill as well as icon colour.
 *
 * The app's tabs draw the same bar with the navigator's own bar, styled in
 * app/(tabs)/_layout.tsx (a custom bar breaks the order of the household
 * settings tests, SAGE-F3); this one shows it in the showcase.
 */
export function TabBar({ items, testID }: Props) {
  const theme = useTheme();
  const s = styles(theme);
  const insets = useSafeAreaInsets();
  return (
    <View
      style={[s.wrap, { bottom: Math.max(theme.size.navBottom, insets.bottom) }]}
      pointerEvents="box-none"
      testID={testID}
    >
      <View style={s.bar}>
        {items.map((item) => (
          <Pressable
            key={item.key}
            onPress={item.onPress}
            onLongPress={item.onLongPress}
            // Buttons with a selected state, as the default tab bar exposes them.
            accessibilityRole="button"
            accessibilityLabel={item.label}
            accessibilityState={{ selected: item.selected }}
            style={({ pressed }) => [s.item, item.selected && s.selected, pressed && s.pressed]}
          >
            <Icon
              name={item.icon}
              size={theme.size.navIcon}
              color={item.selected ? theme.palette.navActiveIcon : theme.palette.ink}
            />
          </Pressable>
        ))}
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
      alignItems: 'center',
    },
    bar: {
      height: t.size.navBar,
      flexDirection: 'row',
      alignItems: 'center',
      gap: t.spacing.sm,
      paddingHorizontal: t.spacing.sm,
      borderRadius: t.radius.pill,
      backgroundColor: t.palette.navBar,
      shadowColor: t.palette.navShadow,
      shadowOffset: { width: 0, height: t.shadow.nav.offsetY },
      shadowRadius: t.shadow.nav.radius,
      shadowOpacity: t.shadow.nav.opacity,
      // Android draws elevation in its own grey; the night bar has no shadow.
      elevation: t.scheme === 'night' ? 0 : t.shadow.nav.elevation,
    },
    item: {
      width: t.size.navButton,
      height: t.size.navButton,
      borderRadius: t.radius.pill,
      backgroundColor: t.palette.navButton,
      alignItems: 'center',
      justifyContent: 'center',
    },
    selected: { backgroundColor: t.palette.navActive },
    pressed: { opacity: t.opacity.pressed },
  });
