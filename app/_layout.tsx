import { Comfortaa_700Bold } from '@expo-google-fonts/comfortaa/700Bold';
import { Manrope_500Medium } from '@expo-google-fonts/manrope/500Medium';
import { Manrope_600SemiBold } from '@expo-google-fonts/manrope/600SemiBold';
import { Manrope_700Bold } from '@expo-google-fonts/manrope/700Bold';
import { Manrope_800ExtraBold } from '@expo-google-fonts/manrope/800ExtraBold';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Platform, StyleSheet, View } from 'react-native';

import { openAppDatabase } from '@/db/client';
import { UndoProvider } from '@/db/undo';
import { NightModeTheme, PreferredNightModeTheme } from '@/features/settings/NightModeTheme';
import { PreferredLanguage } from '@/features/settings/PreferredLanguage';
import { DatabaseGate } from '@/features/startup/DatabaseGate';
import { UndoToast } from '@/features/undo/UndoToast';
import '@/i18n';
import { WEB_STAND_IN } from '@/db/standIn';
import { AuthProvider, createAppAuth } from '@/sync/AuthProvider';
import { createExpoNotificationPort } from '@/notifications/expoPort';
import { RemindersProvider } from '@/notifications/RemindersProvider';
import { SyncProvider } from '@/sync/SyncProvider';
import { DEFAULT_NIGHT_MODE } from '@/domain/time/night';
import { startCrashReporting } from '@/observability/sentry';
import { Notice } from '@/ui/primitives';
import { PAGE_OPTIONS, PUSHED_PAGE_OPTIONS } from '@/ui/pageOptions';
import { useSheetOptions, useTheme } from '@/ui/theme';
import { fonts, type } from '@/ui/tokens';

// Before anything else, so a crash while the database opens is still reported.
// Does nothing unless the build carries an EU Sentry DSN (P4-08).
startCrashReporting();

// Created once per launch; null when the build has no Supabase settings.
const appAuth = createAppAuth();
// One port per launch. The web preview has no notifications to schedule.
const notifications = Platform.OS === 'web' ? null : createExpoNotificationPort();

// The G faces, each loaded under its family name in src/ui/tokens.ts.
// Only these five files are bundled, not every weight of each package.
const FONT_FILES = {
  [fonts.heading]: Comfortaa_700Bold,
  [fonts.text]: Manrope_500Medium,
  [fonts.textSemi]: Manrope_600SemiBold,
  [fonts.textBold]: Manrope_700Bold,
  [fonts.textHeavy]: Manrope_800ExtraBold,
};

export default function RootLayout() {
  // The startup screen stays blank until the fonts load, so no text draws in
  // the system font first. A font that fails to load falls back to the
  // system font rather than holding the app.
  const [fontsLoaded, fontError] = useFonts(FONT_FILES);
  // The stored night mode is in the database, so the brief startup screen
  // uses the default (auto) until it opens.
  return (
    <NightModeTheme mode={DEFAULT_NIGHT_MODE}>
      <DatabaseGate open={openAppDatabase} hold={!fontsLoaded && !fontError}>
        <PreferredNightModeTheme>
          <PreferredLanguage>
            <AuthProvider auth={appAuth}>
              <SyncProvider>
                <RemindersProvider port={notifications}>
                  <UndoProvider>
                    <ThemedStack />
                    <UndoToast />
                  </UndoProvider>
                </RemindersProvider>
              </SyncProvider>
            </AuthProvider>
          </PreferredLanguage>
        </PreferredNightModeTheme>
      </DatabaseGate>
    </NightModeTheme>
  );
}

const SHEET_ROUTES = [
  'log/feed',
  'log/diaper',
  'log/sleep',
  'log/pump',
  'log/health',
  'log/medication',
  'log/weight',
  'log/stock',
  'log/appointment',
  'entry/[id]',
] as const;
const MODAL_PAGE_ROUTES = [
  'feedback',
  'invite',
  'join/[code]',
  'onboarding/agreement',
  'onboarding/consent',
  'onboarding/guardian',
  'onboarding/household',
  'onboarding/join',
  'onboarding/paused',
  'onboarding/removed',
  'onboarding/sign-in',
  'onboarding/terms',
] as const;
const PUSHED_PAGE_ROUTES = [
  'about',
  'baby',
  'leave-or-delete',
  'report/[range]',
  'report/call',
] as const;

function ThemedStack() {
  const theme = useTheme();
  const sheet = useSheetOptions();
  const { t } = useTranslation();
  return (
    <View style={styles.fill}>
      {WEB_STAND_IN && <Notice text={t('dev.webStandIn')} testID="web-stand-in-notice" />}
      <Stack
        screenOptions={{
          contentStyle: { backgroundColor: theme.palette.background },
          // Sage: the header sits on the page colour, without a rule under it.
          headerStyle: { backgroundColor: theme.palette.background },
          headerShadowVisible: false,
          headerTintColor: theme.palette.ink,
          headerTitleStyle: type.rowTitle,
        }}
      >
        {/* The tabs draw their own headers (SDD 7). */}
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        {/*
          Sheets and pages draw their own headers. Their options are declared
          here, not only inside each screen: an option set from inside the
          screen arrives after the screen is presented, so the native header
          (with the raw route name) and the default push showed instead of the
          form sheet (build 7).
        */}
        {SHEET_ROUTES.map((name) => (
          <Stack.Screen key={name} name={name} options={sheet} />
        ))}
        {MODAL_PAGE_ROUTES.map((name) => (
          <Stack.Screen key={name} name={name} options={PAGE_OPTIONS} />
        ))}
        {PUSHED_PAGE_ROUTES.map((name) => (
          <Stack.Screen key={name} name={name} options={PUSHED_PAGE_OPTIONS} />
        ))}
      </Stack>
    </View>
  );
}

const styles = StyleSheet.create({ fill: { flex: 1 } });
