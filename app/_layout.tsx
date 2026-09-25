import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Platform, StyleSheet, View } from 'react-native';

import { openAppDatabase } from '@/db/client';
import { UndoProvider } from '@/db/undo';
import { NightModeTheme, PreferredNightModeTheme } from '@/features/settings/NightModeTheme';
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
import { useTheme } from '@/ui/theme';

// Before anything else, so a crash while the database opens is still reported.
// Does nothing unless the build carries an EU Sentry DSN (P4-08).
startCrashReporting();

// Created once per launch; null when the build has no Supabase settings.
const appAuth = createAppAuth();
// One port per launch. The web preview has no notifications to schedule.
const notifications = Platform.OS === 'web' ? null : createExpoNotificationPort();

export default function RootLayout() {
  // The stored night mode is in the database, so the brief startup screen
  // uses the default (auto) until it opens.
  return (
    <NightModeTheme mode={DEFAULT_NIGHT_MODE}>
      <DatabaseGate open={openAppDatabase}>
        <PreferredNightModeTheme>
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
        </PreferredNightModeTheme>
      </DatabaseGate>
    </NightModeTheme>
  );
}

function ThemedStack() {
  const theme = useTheme();
  const { t } = useTranslation();
  return (
    <View style={styles.fill}>
      {WEB_STAND_IN && <Notice text={t('dev.webStandIn')} testID="web-stand-in-notice" />}
      <Stack
        screenOptions={{
          contentStyle: { backgroundColor: theme.colors.background },
          headerStyle: { backgroundColor: theme.colors.surface },
          headerTintColor: theme.colors.text,
        }}
      >
        {/* The tabs draw their own headers (SDD 7). */}
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      </Stack>
    </View>
  );
}

const styles = StyleSheet.create({ fill: { flex: 1 } });
