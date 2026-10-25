import { Tabs, useRouter } from 'expo-router';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GuardianGate } from '@/features/privacy/GuardianGate';
import type { IconName } from '@/ui/icons';
import { Icon } from '@/ui/primitives';
import { useTheme } from '@/ui/theme';

const TAB_COUNT = 4;

function TabIcon({ name, focused }: { name: IconName; focused: boolean }) {
  const { palette, size } = useTheme();
  return (
    <Icon name={name} size={size.navIcon} color={focused ? palette.navActiveIcon : palette.ink} />
  );
}

/**
 * Home, History, Trends and Settings (SDD 7), drawn as the G floating bar
 * (every tabs/* file): a pill of four round 52 buttons, gap 8, padding 8,
 * centred 30 above the bottom edge (or above a taller system bar), with the
 * nav shadow by day. Icons only; each button keeps its tab's name for
 * screen readers.
 *
 * It is the navigator's default bar, styled, so its behaviour and
 * accessibility stay the same. (A custom `tabBar` breaks the order of the
 * household settings tests, SAGE-F3.) The tabs draw their titles in their
 * content (ScreenTitle), so there is no native header, and the scene keeps
 * its content below the status bar.
 */
export default function TabsLayout() {
  const { t } = useTranslation();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const { size, spacing, palette, radius, shadow } = theme;
  // Half the 8 gap on each side of a button, so the pill's own padding is
  // the other half of 8.
  const itemGap = spacing.sm / 2;
  // The pill's natural width (four 52 buttons, three 8 gaps, 8 padding each
  // side), centred, never closer to the edge than the screen edge.
  const barWidth = TAB_COUNT * (size.navButton + 2 * itemGap) + 2 * (spacing.sm - itemGap);
  const sideMargin = Math.max(spacing.screen, (screenWidth - barWidth) / 2);
  const inset = (size.navBar - size.navButton) / 2;
  const router = useRouter();
  const askGuardian = useCallback(() => router.push('/onboarding/guardian'), [router]);

  return (
    <>
      {/* P0.1: an owner with no guardian declaration on record is asked once. */}
      <GuardianGate onMissing={askGuardian} />
      <Tabs
        screenOptions={{
          headerShown: false,
          // Below the status bar; the scene runs under the floating bar, and
          // each tab's scroll content carries size.tabBarClearance at the bottom.
          sceneStyle: { backgroundColor: palette.background, paddingTop: insets.top },
          tabBarShowLabel: false,
          // Lays each item out as a centred row, so the icon sits in the middle
          // of its button rather than at the top (the "below-icon" column layout).
          tabBarLabelPosition: 'beside-icon',
          tabBarStyle: {
            position: 'absolute',
            // The default bar pins itself with start: 0 and end: 0, which win
            // over left and width; set start and end themselves.
            start: sideMargin,
            end: sideMargin,
            bottom: Math.max(size.navBottom, insets.bottom),
            height: size.navBar,
            // Replaces the safe-area padding the default bar adds.
            paddingTop: inset,
            paddingBottom: inset,
            paddingHorizontal: spacing.sm - itemGap,
            borderRadius: radius.pill,
            borderTopWidth: 0,
            backgroundColor: palette.navBar,
            shadowColor: palette.navShadow,
            shadowOffset: { width: 0, height: shadow.nav.offsetY },
            shadowRadius: shadow.nav.radius,
            shadowOpacity: shadow.nav.opacity,
            // Android draws elevation in its own grey; the night bar has no shadow.
            elevation: theme.scheme === 'night' ? 0 : shadow.nav.elevation,
          },
          // flex: 1 reaches the inner pressable that paints the item's colour,
          // so it fills the whole 52 button; the item's round, clipped corners
          // then make it a circle.
          tabBarItemStyle: {
            flex: 1,
            height: size.navButton,
            marginHorizontal: itemGap,
            borderRadius: radius.pill,
            overflow: 'hidden',
          },
          tabBarActiveBackgroundColor: palette.navActive,
          tabBarInactiveBackgroundColor: palette.navButton,
          tabBarActiveTintColor: palette.navActiveIcon,
          tabBarInactiveTintColor: palette.ink,
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: t('tabs.home'),
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
    </>
  );
}
