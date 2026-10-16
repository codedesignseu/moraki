import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { HomeScreen, type LogKind } from '@/features/home/HomeScreen';
import { Icon, ListRow } from '@/ui/primitives';
import { useTheme, type Theme } from '@/ui/theme';

const LOG_ROUTES = {
  feed: '/log/feed',
  sleep: '/log/sleep',
  diaper: '/log/diaper',
  pump: '/log/pump',
  health: '/log/health',
  medication: '/log/medication',
} as const satisfies Record<LogKind, string>;

export default function Home() {
  const { t } = useTranslation();
  const router = useRouter();
  const theme = useTheme();
  const s = styles(theme);
  const log = (kind: LogKind) => router.push(LOG_ROUTES[kind]);
  // Drawn, not a second button: the whole row is the button.
  const plus = (
    <View style={s.plus}>
      <Icon name="plus" />
    </View>
  );
  return (
    <HomeScreen
      onLog={log}
      onOpenEntry={(id) => router.push({ pathname: '/entry/[id]', params: { id } })}
      onAdjustStock={(place) => router.push({ pathname: '/log/stock', params: { place } })}
      onAppointment={(id) =>
        id === undefined
          ? router.push('/log/appointment')
          : router.push({ pathname: '/entry/[id]', params: { id } })
      }
      actions={
        <>
          <ListRow
            title={t('home.actions.health')}
            icon="health"
            accessibilityLabel={t('home.actions.health')}
            trailing={plus}
            onPress={() => log('health')}
          />
          <ListRow
            title={t('home.actions.medication')}
            icon="health"
            accessibilityLabel={t('home.actions.medication')}
            trailing={plus}
            onPress={() => log('medication')}
          />
        </>
      }
    />
  );
}

const styles = (t: Theme) =>
  StyleSheet.create({
    plus: {
      width: t.size.iconButton,
      height: t.size.iconButton,
      borderRadius: t.radius.pill,
      backgroundColor: t.palette.line,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
