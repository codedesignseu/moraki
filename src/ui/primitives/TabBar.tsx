import { Pressable, StyleSheet, View } from 'react-native';

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
};

type Props = {
  items: readonly TabBarItem[];
  testID?: string;
};

/**
 * Sage floating tab bar: a 66 high pill, 30 above the bottom edge. The
 * active tab is a filled pill, so it differs in shape as well as colour.
 */
export function TabBar({ items, testID }: Props) {
  const theme = useTheme();
  const s = styles(theme);
  return (
    <View style={s.wrap} pointerEvents="box-none" testID={testID}>
      <View style={s.bar}>
        {items.map((item) => (
          <Pressable
            key={item.key}
            onPress={item.onPress}
            // Buttons with a selected state, as the default tab bar exposes them.
            accessibilityRole="button"
            accessibilityLabel={item.label}
            accessibilityState={{ selected: item.selected }}
            style={({ pressed }) => [s.item, item.selected && s.selected, pressed && s.pressed]}
          >
            <Icon
              name={item.icon}
              color={item.selected ? theme.palette.onTabActive : theme.palette.onTabBar}
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
      bottom: t.size.tabBarBottomOffset,
      alignItems: 'center',
    },
    bar: {
      height: t.size.tabBar,
      flexDirection: 'row',
      alignItems: 'center',
      gap: t.spacing.xs,
      paddingHorizontal: t.spacing.sm,
      borderRadius: t.radius.pill,
      backgroundColor: t.palette.tabBar,
    },
    item: {
      width: t.size.tabItemWidth,
      height: t.size.tabItemHeight,
      borderRadius: t.radius.pill,
      alignItems: 'center',
      justifyContent: 'center',
    },
    selected: { backgroundColor: t.palette.tabActive },
    pressed: { opacity: t.opacity.pressed },
  });
