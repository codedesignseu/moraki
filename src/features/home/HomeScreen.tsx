import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button, Card, EntryRow, Icon, TimerText } from '@/ui/primitives';
import { useTheme, type Theme } from '@/ui/theme';

import { useHome, type RecentRow, type StockPlaceView } from './useHome';

type Translate = (key: string, values?: Record<string, string | number>) => string;

/** Renders the home view model and nothing else (SDD 15.4). */
export function HomeScreen({
  actions,
  onOpenEntry,
  onAdjustStock,
  onAppointment,
}: {
  actions?: ReactNode;
  /** Opens an entry to edit (P1-12). Supplied by app/ so features stay independent. */
  onOpenEntry?: (id: string) => void;
  /** Opens the adjust sheet for a store (P3-03). */
  onAdjustStock?: (place: 'fridge' | 'freezer') => void;
  /** Opens an appointment to edit, or the sheet to add one (P3-12). */
  onAppointment?: (id?: string) => void;
}) {
  const { t: typedT } = useTranslation();
  // Keys from activity modules are checked by the registry completeness test.
  const t = typedT as unknown as Translate;
  const home = useHome();
  const theme = useTheme();
  const s = styles(theme);

  return (
    <ScrollView contentContainerStyle={s.screen}>
      {/* Sage 07 timer card, without the ring (D2). */}
      <View style={[s.hero, s.feedTint]} testID="home-timer">
        <Text style={s.onTileSoft}>{t('home.timer.label')}</Text>
        {home.sinceLastFeed === null ? (
          <Text style={[theme.type.heading, s.onTile, s.center]}>{t('home.timer.none')}</Text>
        ) : (
          <TimerText text={home.sinceLastFeed} />
        )}
        {home.nextSide && (
          <Text style={[theme.type.rowTitle, s.onTile, s.center]}>
            {t(`home.nextSide.${home.nextSide}`)}
          </Text>
        )}
        {home.reminder && (
          <Text style={s.onTileSoft}>
            {t(home.reminder.passed ? 'home.reminder.passed' : 'home.reminder.upcoming', {
              time: home.reminder.time,
            })}
          </Text>
        )}
      </View>

      {home.duplicate && (
        <View style={[s.panel, s.feedTint]} testID="home-duplicate">
          <Text style={[theme.type.body, s.onTile]}>
            {t('home.duplicate.question', { name: home.duplicate.by, time: home.duplicate.time })}
          </Text>
          <Button
            label={t('home.duplicate.keepBoth')}
            variant="secondary"
            onPress={() => home.keepBoth(home.duplicate?.id ?? '')}
          />
          <Button
            label={t('home.duplicate.removeMine')}
            variant="secondary"
            onPress={() => home.removeDuplicate(home.duplicate?.id ?? '')}
          />
        </View>
      )}

      {home.activeSleep && (
        <View style={[s.panel, s.sleepTint]} testID="home-sleep">
          <View style={s.titleRow}>
            <Icon name="sleep" color={theme.palette.onTile} />
            <Text style={[s.onTileSoft, s.flex]}>
              {t('home.sleep.label', { time: home.activeSleep.startedAt })}
            </Text>
          </View>
          <TimerText text={home.activeSleep.elapsed} />
          <Button
            label={t('home.sleep.stop')}
            variant="secondary"
            onPress={() => home.activeSleep && home.stopSleep(home.activeSleep.id)}
          />
        </View>
      )}

      {actions && <View style={s.actions}>{actions}</View>}

      <Card testID="home-today">
        <Text style={theme.text.heading}>{t('home.today.title')}</Text>
        <View style={s.strip}>
          <Stat label={t('home.today.feeds')} value={home.today.feeds} />
          <Stat label={t('home.today.ml')} value={home.today.ml} />
          <Stat label={t('home.today.breastfeeding')} value={home.today.breastfeeding} />
          <Stat label={t('home.today.wet')} value={home.today.wet} />
          <Stat label={t('home.today.dirty')} value={home.today.dirty} />
        </View>
        <Text style={theme.text.body}>
          {t('home.today.sleep24h', { duration: home.today.sleep })}
        </Text>
      </Card>

      <Card testID="home-appointment">
        <View style={s.titleRow}>
          <Icon name="visit" />
          <Text style={[theme.type.heading, s.flex]}>{t('home.appointment.title')}</Text>
        </View>
        {home.appointment ? (
          <Text
            style={theme.text.body}
            testID={`appointment-${home.appointment.id}`}
            {...(onAppointment && {
              accessibilityRole: 'button' as const,
              onPress: () => onAppointment(home.appointment?.id),
            })}
          >
            {t('home.appointment.when', {
              title: home.appointment.title,
              when: home.appointment.when,
            })}
          </Text>
        ) : (
          <Text style={s.muted}>{t('home.appointment.none')}</Text>
        )}
        {onAppointment && (
          <Button
            label={t('home.appointment.add')}
            variant="secondary"
            onPress={() => onAppointment()}
          />
        )}
      </Card>

      <Card testID="home-stock">
        <View style={s.titleRow}>
          <Icon name="pump" />
          <Text style={[theme.type.heading, s.flex]}>{t('home.stock.title')}</Text>
        </View>
        <View style={s.strip}>
          <Place
            name={t('home.stock.fridge')}
            tint="diaper"
            place={home.stock.fridge}
            t={t}
            {...(onAdjustStock && { onAdjust: () => onAdjustStock('fridge') })}
          />
          <Place
            name={t('home.stock.freezer')}
            tint="sleep"
            place={home.stock.freezer}
            t={t}
            {...(onAdjustStock && { onAdjust: () => onAdjustStock('freezer') })}
          />
        </View>
      </Card>

      <Card testID="home-recent">
        <Text style={theme.text.heading}>{t('home.recent.title')}</Text>
        {home.lastEntryBy && (
          <Text style={s.muted}>{t('home.recent.lastBy', { name: home.lastEntryBy })}</Text>
        )}
        {home.recent.length === 0 ? (
          <Text style={s.muted}>{t('home.recent.empty')}</Text>
        ) : (
          home.recent.map((row) => <Row key={row.id} row={row} t={t} onOpen={onOpenEntry} />)
        )}
      </Card>
    </ScrollView>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  const theme = useTheme();
  const s = styles(theme);
  return (
    <View style={s.stat} accessible accessibilityLabel={`${label}: ${value}`}>
      <Text style={theme.text.title}>{value}</Text>
      <Text style={s.muted}>{label}</Text>
    </View>
  );
}

function Place({
  name,
  tint,
  place,
  t,
  onAdjust,
}: {
  name: string;
  /** Sage 15: fridge and freezer each on their tile colour. */
  tint: 'diaper' | 'sleep';
  place: StockPlaceView;
  t: Translate;
  onAdjust?: (() => void) | undefined;
}) {
  const theme = useTheme();
  const s = styles(theme);
  return (
    <View style={[s.place, { backgroundColor: theme.palette[tint] }]}>
      <Text style={[theme.type.tileTitle, s.onTile]}>{name}</Text>
      <Text style={[theme.type.title, s.onTile]}>{t('home.stock.amount', { ml: place.ml })}</Text>
      {place.age && (
        <Text style={s.onTileSoft}>
          {t(`home.stock.oldest.${place.age.scale}`, { count: place.age.value })}
        </Text>
      )}
      {/* A count that has gone past empty is a count to check, not a number
          to trust, so the way to fix it sits right next to it (SDD 6.3). */}
      {place.short && <Text style={s.onTileSoft}>{t('home.stock.short')}</Text>}
      {onAdjust && (
        <Button
          label={t('home.stock.adjust', { place: name })}
          variant="secondary"
          onPress={onAdjust}
        />
      )}
    </View>
  );
}

function Row({
  row,
  t,
  onOpen,
}: {
  row: RecentRow;
  t: Translate;
  onOpen?: ((id: string) => void) | undefined;
}) {
  // An appointment is the one entry that can be in the future: dayBucket's
  // daysAgo goes negative rather than 0-based, so it needs its own words
  // rather than falling into "N days ago" with a sign nobody reads.
  const when =
    row.daysAgo === 0
      ? row.time
      : row.daysAgo === 1
        ? t('home.recent.yesterday', { time: row.time })
        : row.daysAgo === -1
          ? t('home.recent.tomorrow', { time: row.time })
          : row.daysAgo < 0
            ? t('home.recent.inDays', { count: -row.daysAgo, time: row.time })
            : t('home.recent.daysAgo', { count: row.daysAgo, time: row.time });
  return (
    <EntryRow
      testID={`recent-${row.id}`}
      title={t(row.labelKey)}
      detail={row.summary ? t(row.summary.key, row.summary.values) : undefined}
      meta={[when, row.byYou ? t('home.recent.you') : (row.by ?? t('home.recent.other'))]}
      {...(onOpen && { onPress: () => onOpen(row.id), accessibilityHint: t('entry.openHint') })}
    />
  );
}

const styles = (theme: Theme) =>
  StyleSheet.create({
    screen: {
      padding: theme.spacing.screen,
      paddingBottom: theme.size.tabBarClearance,
      gap: theme.spacing.lg,
    },
    actions: { gap: theme.spacing.md },
    muted: { ...theme.type.detail, color: theme.palette.textSoft },
    strip: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.md },
    stat: { minWidth: theme.size.touchTargetLarge, alignItems: 'flex-start' },
    hero: {
      borderRadius: theme.radius.tile,
      padding: theme.spacing.xl,
      gap: theme.spacing.sm,
      alignItems: 'center',
    },
    panel: { borderRadius: theme.radius.card, padding: theme.spacing.lg, gap: theme.spacing.md },
    feedTint: { backgroundColor: theme.palette.feed },
    sleepTint: { backgroundColor: theme.palette.sleep },
    onTile: { color: theme.palette.onTile },
    center: { textAlign: 'center' },
    onTileSoft: { ...theme.type.detail, color: theme.palette.onTileSoft },
    titleRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
    flex: { flex: 1 },
    place: {
      flex: 1,
      minWidth: theme.size.activityTile,
      borderRadius: theme.radius.card,
      padding: theme.spacing.lg,
      gap: theme.spacing.xs,
    },
  });
