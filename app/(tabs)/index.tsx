import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { HomeScreen } from '@/features/home/HomeScreen';
import { ActivityTile, Icon, ListRow } from '@/ui/primitives';
import { useTheme, type Theme } from '@/ui/theme';

export default function Home() {
  const { t } = useTranslation();
  const router = useRouter();
  const theme = useTheme();
  const s = styles(theme);
  // Drawn, not a second button: the whole row is the button.
  const plus = (
    <View style={s.plus}>
      <Icon name="plus" />
    </View>
  );
  return (
    <>
      <HomeScreen
        onOpenEntry={(id) => router.push({ pathname: '/entry/[id]', params: { id } })}
        onAdjustStock={(place) => router.push({ pathname: '/log/stock', params: { place } })}
        onAppointment={(id) =>
          id === undefined
            ? router.push('/log/appointment')
            : router.push({ pathname: '/entry/[id]', params: { id } })
        }
        actions={
          <>
            {/* Sage 06: four activity tiles, then the health rows. */}
            <View style={s.tiles}>
              <ActivityTile
                colour="feed"
                icon="feed"
                title={t('home.actions.feed')}
                accessibilityLabel={t('home.logFeed')}
                onPress={() => router.push('/log/feed')}
              />
              <ActivityTile
                colour="sleep"
                icon="sleep"
                title={t('home.actions.sleep')}
                accessibilityLabel={t('home.actions.sleep')}
                onPress={() => router.push('/log/sleep')}
              />
            </View>
            <View style={s.tiles}>
              <ActivityTile
                colour="diaper"
                icon="diaper"
                title={t('home.actions.diaper')}
                accessibilityLabel={t('home.actions.diaper')}
                onPress={() => router.push('/log/diaper')}
              />
              <ActivityTile
                colour="pump"
                icon="pump"
                title={t('home.actions.pump')}
                accessibilityLabel={t('home.actions.pump')}
                onPress={() => router.push('/log/pump')}
              />
            </View>
            <ListRow
              title={t('home.actions.health')}
              icon="health"
              accessibilityLabel={t('home.actions.health')}
              trailing={plus}
              onPress={() => router.push('/log/health')}
            />
            <ListRow
              title={t('home.actions.medication')}
              icon="health"
              accessibilityLabel={t('home.actions.medication')}
              trailing={plus}
              onPress={() => router.push('/log/medication')}
            />
          </>
        }
      />
    </>
  );
}

const styles = (t: Theme) =>
  StyleSheet.create({
    tiles: { flexDirection: 'row', gap: t.spacing.md },
    plus: {
      width: t.size.iconButton,
      height: t.size.iconButton,
      borderRadius: t.radius.pill,
      backgroundColor: t.palette.line,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
