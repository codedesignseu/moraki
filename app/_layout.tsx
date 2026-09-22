import { Stack } from 'expo-router';
import { useColorScheme } from 'react-native';

import { openAppDatabase } from '@/db/client';
import { DatabaseGate } from '@/features/startup/DatabaseGate';
import '@/i18n';
import { ThemeProvider, useTheme } from '@/ui/theme';

export default function RootLayout() {
  // Follows the OS for now. The night mode setting (auto 21:00 to 06:00, on, off) is P1-16.
  const scheme = useColorScheme() === 'dark' ? 'night' : 'light';
  return (
    <ThemeProvider scheme={scheme}>
      <DatabaseGate open={openAppDatabase}>
        <ThemedStack />
      </DatabaseGate>
    </ThemeProvider>
  );
}

function ThemedStack() {
  const theme = useTheme();
  return (
    <Stack
      screenOptions={{
        contentStyle: { backgroundColor: theme.colors.background },
        headerStyle: { backgroundColor: theme.colors.surface },
        headerTintColor: theme.colors.text,
      }}
    />
  );
}
