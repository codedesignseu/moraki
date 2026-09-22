import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, useColorScheme, View } from 'react-native';

import { openAppDatabase } from '@/db/client';
import { UndoProvider } from '@/db/undo';
import { DatabaseGate } from '@/features/startup/DatabaseGate';
import { UndoToast } from '@/features/undo/UndoToast';
import '@/i18n';
import { WEB_STAND_IN } from '@/db/standIn';
import { Notice } from '@/ui/primitives';
import { ThemeProvider, useTheme } from '@/ui/theme';

export default function RootLayout() {
  // Follows the OS for now. The night mode setting (auto 21:00 to 06:00, on, off) is P1-16.
  const scheme = useColorScheme() === 'dark' ? 'night' : 'light';
  return (
    <ThemeProvider scheme={scheme}>
      <DatabaseGate open={openAppDatabase}>
        <UndoProvider>
          <ThemedStack />
          <UndoToast />
        </UndoProvider>
      </DatabaseGate>
    </ThemeProvider>
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
