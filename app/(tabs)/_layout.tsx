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
  const barWidth = TAB_COUNT * (size.tabItemWidth + 2 * itemGap) + 2 * (spacing.sm - itemGap);

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: palette.background },
        headerShadowVisible: false,
        headerTintColor: palette.ink,
        headerTitleStyle: type.rowTitle,
        // Content ends above the floating bar, so nothing hides behind it.
        sceneStyle: {
          backgroundColor: palette.background,
          paddingBottom: size.tabBar + size.tabBarBottomOffset,
        },
        tabBarShowLabel: false,
        tabBarStyle: {
          position: 'absolute',
          bottom: size.tabBarBottomOffset,
          left: (screenWidth - barWidth) / 2,
          width: barWidth,
          height: size.tabBar,
          paddingTop: (size.tabBar - size.tabItemHeight) / 2,
          paddingBottom: (size.tabBar - size.tabItemHeight) / 2,
          paddingHorizontal: spacing.sm - itemGap,
          borderRadius: radius.pill,
          borderTopWidth: 0,
          backgroundColor: palette.tabBar,
          elevation: 0,
          shadowOpacity: 0,
        },
        tabBarItemStyle: {
          flex: 0,
          width: size.tabItemWidth,
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
