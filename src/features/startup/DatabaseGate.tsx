import { useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import {
  DevicePrefsProvider,
  EventsRepositoryProvider,
  SyncRepositoriesProvider,
  type AppRepositories,
} from '@/db/react';
import { useTheme } from '@/ui/theme';

type State =
  { status: 'opening' } | { status: 'ready'; repositories: AppRepositories } | { status: 'failed' };

/**
 * Opens the database and runs migrations before the first screen (P1-F3).
 * Nothing renders data until the schema is current, and a failed migration
 * shows a message instead of a half-working app.
 */
export function DatabaseGate({
  open,
  children,
}: {
  open: () => Promise<AppRepositories>;
  children: ReactNode;
}) {
  const [state, setState] = useState<State>({ status: 'opening' });
  const { t } = useTranslation();
  const theme = useTheme();

  useEffect(() => {
    let active = true;
    open().then(
      (repositories) => active && setState({ status: 'ready', repositories }),
      () => active && setState({ status: 'failed' }),
    );
    return () => {
      active = false;
    };
  }, [open]);

  if (state.status === 'ready') {
    return (
      <EventsRepositoryProvider repository={state.repositories.events}>
        <DevicePrefsProvider repository={state.repositories.devicePrefs}>
          <SyncRepositoriesProvider repositories={state.repositories}>
            {children}
          </SyncRepositoriesProvider>
        </DevicePrefsProvider>
      </EventsRepositoryProvider>
    );
  }
  return (
    <View
      style={[
        StyleSheet.absoluteFill,
        { backgroundColor: theme.colors.background, padding: theme.spacing.xl },
      ]}
    >
      {state.status === 'failed' && (
        <Text accessibilityRole="alert" style={theme.text.body}>
          {t('startup.databaseFailed')}
        </Text>
      )}
    </View>
  );
}
