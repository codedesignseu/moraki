import { Tabs } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useWindowDimensions } from 'react-native';

import type { IconName } from '@/ui/icons';
import { Icon } from '@/ui/primitives';
import { useTheme } from '@/ui/theme';
import { type } from '@/ui/tokens';

const TAB_COUNT = 4;

function TabIcon({ name, focused }: { name: IconName; focused: boolean }) {
  const { palette } = useTheme();
  return <Icon name={name} color={focused ? palette.onTabActive : palette.onTabBar} />;
}

/**
 * Home, History, Trends and Settings (SDD 7). The default tab bar, so its
 * behaviour and accessibility stay the same, drawn as the Sage floating bar:
 * a 66 high pill, 30 above the bottom edge, icons only, the active tab a
 * filled pill (shape as well as colour).
 */
export default function TabsLayout() {
  const { t } = useTranslation();
  const theme = useTheme();
  const { width: screenWidth } = useWindowDimensions();
  const { size, spacing, palette, radius } = theme;
  const itemGap = spacing.xs / 2;
  // The pill's natural width (four 64 items, their gaps, its inner padding),
  // centred with equal margins, never closer to the edge than the screen edge.
  const barWidth = TAB_COUNT * (size.tabItemWidth + 2 * itemGap) + 2 * (spacing.sm - itemGap);
  const sideMargin = Math.max(spacing.screen, (screenWidth - barWidth) / 2);

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: palette.background },
        headerShadowVisible: false,
        headerTintColor: palette.ink,
        headerTitleStyle: type.rowTitle,
        // The scene runs under the floating bar; each tab's scroll content
        // carries size.tabBarClearance at the bottom instead.
        sceneStyle: { backgroundColor: palette.background },
        tabBarShowLabel: false,
        // Lays each item out as a centred row, so the icon sits in the middle
        // of its pill rather than at the top (the "below-icon" column layout).
        tabBarLabelPosition: 'beside-icon',
        tabBarStyle: {
          position: 'absolute',
          // The default bar pins itself with start: 0 and end: 0, which win
          // over left and width; set start and end themselves.
          start: sideMargin,
          end: sideMargin,
          bottom: size.tabBarBottomOffset,
          height: size.tabBar,
          // Replaces the safe-area bottom padding the default bar adds: the
          // pill floats 30 above the edge, clear of the home indicator.
          paddingTop: (size.tabBar - size.tabItemHeight) / 2,
          paddingBottom: (size.tabBar - size.tabItemHeight) / 2,
          paddingHorizontal: spacing.sm - itemGap,
          borderRadius: radius.pill,
          borderTopWidth: 0,
          backgroundColor: palette.tabBar,
          elevation: 0,
          shadowOpacity: 0,
        },
        // flex: 1 reaches the inner pressable that paints the active colour,
        // so it fills the whole 48 high item; the item's round, clipped
        // corners then give the active pill its round ends.
        tabBarItemStyle: {
          flex: 1,
          height: size.tabItemHeight,
          marginHorizontal: itemGap,
          borderRadius: radius.pill,
          overflow: 'hidden',
        },
        tabBarActiveBackgroundColor: palette.tabActive,
        tabBarActiveTintColor: palette.onTabActive,
        tabBarInactiveTintColor: palette.onTabBar,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t('app.name'),
          tabBarLabel: t('tabs.home'),
          tabBarIcon: ({ focused }) => <TabIcon name="tab-home" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: t('tabs.history'),
          tabBarLabel: t('tabs.history'),
          tabBarIcon: ({ focused }) => <TabIcon name="tab-history" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="insights"
        options={{
          title: t('tabs.insights'),
          tabBarLabel: t('tabs.insights'),
          tabBarIcon: ({ focused }) => <TabIcon name="tab-insights" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: t('tabs.settings'),
          tabBarLabel: t('tabs.settings'),
          tabBarIcon: ({ focused }) => <TabIcon name="tab-settings" focused={focused} />,
        }}
      />
    </Tabs>
  );
}
