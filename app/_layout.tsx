import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { openAppDatabase } from '@/db/client';
import { UndoProvider } from '@/db/undo';
import { NightModeTheme, PreferredNightModeTheme } from '@/features/settings/NightModeTheme';
import { DatabaseGate } from '@/features/startup/DatabaseGate';
import { UndoToast } from '@/features/undo/UndoToast';
import '@/i18n';
import { WEB_STAND_IN } from '@/db/standIn';
import { AuthProvider, createAppAuth } from '@/sync/AuthProvider';
import { DEFAULT_NIGHT_MODE } from '@/domain/time/night';
import { Notice } from '@/ui/primitives';
import { useTheme } from '@/ui/theme';

// Created once per launch; null when the build has no Supabase settings.
const appAuth = createAppAuth();

export default function RootLayout() {
  // The stored night mode is in the database, so the brief startup screen
  // uses the default (auto) until it opens.
  return (
    <NightModeTheme mode={DEFAULT_NIGHT_MODE}>
      <DatabaseGate open={openAppDatabase}>
        <PreferredNightModeTheme>
          <AuthProvider auth={appAuth}>
            <UndoProvider>
              <ThemedStack />
              <UndoToast />
            </UndoProvider>
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
