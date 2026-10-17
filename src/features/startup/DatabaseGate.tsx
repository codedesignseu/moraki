import { useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import {
  DevicePrefsProvider,
  EventsRepositoryProvider,
  SyncRepositoriesProvider,
  type AppRepositories,
} from '@/db/react';
import { Logo } from '@/ui/primitives';
import { useTheme, type Theme } from '@/ui/theme';

type State =
  { status: 'opening' } | { status: 'ready'; repositories: AppRepositories } | { status: 'failed' };

/**
 * Opens the database and runs migrations before the first screen (P1-F3).
 * Nothing renders data until the schema is current, and a failed migration
 * shows a message instead of a half-working app.
 *
 * `hold` keeps the blank opening screen up while something else the first
 * screen needs is still loading (the app fonts), so nothing draws in a
 * fallback font and then changes.
 */
export function DatabaseGate({
  open,
  hold = false,
  children,
}: {
  open: () => Promise<AppRepositories>;
  hold?: boolean;
  children: ReactNode;
}) {
  const [state, setState] = useState<State>({ status: 'opening' });
  const { t } = useTranslation();
  const theme = useTheme();
  const s = styles(theme);

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

  if (state.status === 'ready' && !hold) {
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
  // G reports/startup-fail: the mark, a 22 title and the app's body line,
  // centred. G's "Try again" is left out (G3): opening again is new behaviour.
  return (
    <View style={[StyleSheet.absoluteFill, s.screen]}>
      {state.status === 'failed' && !hold && (
        <View style={s.failed} accessible accessibilityRole="alert">
          <Logo accessibilityLabel={t('app.name')} height={theme.size.logoStartup} />
          <Text style={[theme.type.heading, s.title]}>{t('startup.failedTitle')}</Text>
          <Text style={[theme.type.lead, s.body]}>{t('startup.databaseFailed')}</Text>
        </View>
      )}
    </View>
  );
}

const styles = (theme: Theme) =>
  StyleSheet.create({
    screen: {
      backgroundColor: theme.palette.background,
      justifyContent: 'center',
      padding: theme.spacing.xl,
    },
    failed: { alignItems: 'center', gap: theme.spacing.lg },
    title: { color: theme.palette.ink, textAlign: 'center' },
    body: { color: theme.palette.textSoft, textAlign: 'center' },
  });
