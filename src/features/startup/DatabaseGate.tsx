import { useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { EventsRepositoryProvider } from '@/db/react';
import type { EventsRepository } from '@/db/repositories/events';
import { useTheme } from '@/ui/theme';

type State =
  { status: 'opening' } | { status: 'ready'; repository: EventsRepository } | { status: 'failed' };

/**
 * Opens the database and runs migrations before the first screen (P1-F3).
 * Nothing renders data until the schema is current, and a failed migration
 * shows a message instead of a half-working app.
 */
export function DatabaseGate({
  open,
  children,
}: {
  open: () => Promise<EventsRepository>;
  children: ReactNode;
}) {
  const [state, setState] = useState<State>({ status: 'opening' });
  const { t } = useTranslation();
  const theme = useTheme();

  useEffect(() => {
    let active = true;
    open().then(
      (repository) => active && setState({ status: 'ready', repository }),
      () => active && setState({ status: 'failed' }),
    );
    return () => {
      active = false;
    };
  }, [open]);

  if (state.status === 'ready') {
    return (
      <EventsRepositoryProvider repository={state.repository}>{children}</EventsRepositoryProvider>
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
