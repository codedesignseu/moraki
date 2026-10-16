import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import {
  ActivityTile,
  Button,
  Card,
  EntryRow,
  Icon,
  Logo,
  PillButton,
  TimerText,
} from '@/ui/primitives';
import { HOME_TILES, type HomeTile } from '@/domain/activities';
import { useTheme, type Theme } from '@/ui/theme';

import { useHome, type HomeViewModel, type RecentRow, type StockPlaceView } from './useHome';

type Translate = (key: string, values?: Record<string, string | number>) => string;

/** What Home can open a log sheet for: the four tiles, then the health rows. */
export type LogKind = 'feed' | 'sleep' | 'diaper' | 'pump' | 'health' | 'medication';

/** Renders the home view model and nothing else (SDD 15.4). */
export function HomeScreen({
  actions,
  onLog,
  onOpenEntry,
  onAdjustStock,
  onAppointment,
}: {
  /** Shown under the tiles: the health and medication rows. */
  actions?: ReactNode;
  /** Opens a log sheet. Supplied by app/, which owns navigation. */
  onLog?: (kind: LogKind) => void;
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
      <Greeting greeting={home.greeting} t={t} />
      <Hero home={home} t={t} onLog={onLog} />

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

      {onLog && <Tiles tiles={home.tiles} t={t} onLog={onLog} />}

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

/** G greeting: the mark in a butter circle, "Hello, Name" and whose day it is. */
function Greeting({ greeting, t }: { greeting: HomeViewModel['greeting']; t: Translate }) {
  const theme = useTheme();
  const s = styles(theme);
  return (
    <View style={s.greeting} testID="home-greeting">
      {/* The mark is decoration here: the greeting is the screen's heading. */}
      <View
        style={s.greetingBadge}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <Logo accessibilityLabel={t('app.name')} height={theme.size.greetingMark} />
      </View>
      <View style={s.flex}>
        <Text accessibilityRole="header" style={[theme.type.greeting, s.ink]}>
          {greeting.name === null
            ? t('home.greeting.hello')
            : t('home.greeting.named', { name: greeting.name })}
        </Text>
        <Text style={[theme.type.note, s.soft]}>
          {greeting.baby === null
            ? t('home.greeting.day')
            : t('home.greeting.babyDay', { baby: greeting.baby })}
        </Text>
      </View>
    </View>
  );
}

/**
 * G hero (tabs/home): "Since last feed" on the feed colour, the time since in
 * Comfortaa 38, the reminder line and "Log a feed". The app's next-side line
 * stays in it. The circles behind are decoration.
 */
function Hero({
  home,
  t,
  onLog,
}: {
  home: HomeViewModel;
  t: Translate;
  onLog?: ((kind: LogKind) => void) | undefined;
}) {
  const theme = useTheme();
  const s = styles(theme);
  return (
    <View style={s.hero} testID="home-timer">
      <View style={s.heroCircle} pointerEvents="none" />
      <View style={s.heroBadge} pointerEvents="none">
        <Icon name="feed" size={theme.size.heroIcon} color={theme.palette.onButtonPrimary} />
      </View>
      <View style={s.heroBody}>
        <View style={s.heroTag}>
          <Text style={[theme.type.statLabel, s.ink]}>{t('home.timer.label')}</Text>
        </View>
        {home.sinceLastFeed === null ? (
          <>
            <Text style={[theme.type.title, s.ink, s.heroNumber]}>{t('home.timer.none')}</Text>
            <Text style={[theme.type.note, s.soft]}>{t('home.timer.noneHint')}</Text>
          </>
        ) : (
          <View style={s.heroNumber}>
            <TimerText variant="hero" text={home.sinceLastFeed} />
          </View>
        )}
        {home.nextSide && (
          <Text style={[theme.type.detailBold, s.ink]}>{t(`home.nextSide.${home.nextSide}`)}</Text>
        )}
        {home.reminder && (
          <Text style={[theme.type.note, s.soft]}>
            {t(home.reminder.passed ? 'home.reminder.passed' : 'home.reminder.upcoming', {
              time: home.reminder.time,
            })}
          </Text>
        )}
        {onLog && (
          <View style={s.heroAction}>
            <PillButton label={t('home.logAFeed')} onPress={() => onLog('feed')} />
          </View>
        )}
      </View>
    </View>
  );
}

/** G: the four activity tiles, two by two, each with its last-time line. */
function Tiles({
  tiles,
  t,
  onLog,
}: {
  tiles: HomeViewModel['tiles'];
  t: Translate;
  onLog: (kind: LogKind) => void;
}) {
  const theme = useTheme();
  const s = styles(theme);
  const tile = (kind: HomeTile) => (
    <ActivityTile
      key={kind}
      colour={kind}
      icon={kind}
      title={t(`home.actions.${kind}`)}
      detail={tiles[kind]}
      // The feed tile has always been "Log feed"; the others are named by their kind.
      accessibilityLabel={kind === 'feed' ? t('home.logFeed') : t(`home.actions.${kind}`)}
      onPress={() => onLog(kind)}
      testID={`home-tile-${kind}`}
    />
  );
  return (
    <View style={s.tiles}>
      <View style={s.tileRow}>{HOME_TILES.slice(0, 2).map(tile)}</View>
      <View style={s.tileRow}>{HOME_TILES.slice(2).map(tile)}</View>
    </View>
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
      paddingHorizontal: theme.spacing.screen,
      paddingTop: theme.spacing.md,
      paddingBottom: theme.size.tabBarClearance,
      gap: theme.spacing.section,
    },
    ink: { color: theme.palette.ink },
    soft: { color: theme.palette.textSoft },
    greeting: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md },
    greetingBadge: {
      width: theme.size.greetingBadge,
      height: theme.size.greetingBadge,
      borderRadius: theme.radius.pill,
      borderWidth: theme.size.greetingBadgeBorder,
      borderColor: theme.palette.card,
      backgroundColor: theme.palette.feed,
      alignItems: 'center',
      justifyContent: 'center',
    },
    hero: {
      overflow: 'hidden',
      borderRadius: theme.radius.hero,
      padding: theme.spacing.screenEdge,
      backgroundColor: theme.palette.feed,
    },
    heroCircle: {
      position: 'absolute',
      top: -theme.size.heroCircleOffset,
      right: -theme.size.heroCircleOffset,
      width: theme.size.heroCircle,
      height: theme.size.heroCircle,
      borderRadius: theme.radius.pill,
      backgroundColor: theme.palette.heroCircle,
    },
    heroBadge: {
      position: 'absolute',
      top: theme.size.heroBadgeTop,
      right: theme.size.heroBadgeRight,
      width: theme.size.heroBadge,
      height: theme.size.heroBadge,
      borderRadius: theme.radius.pill,
      backgroundColor: theme.palette.buttonPrimary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    // Clear of the dark circle on the right, whatever the screen width.
    heroBody: {
      gap: theme.spacing.xs,
      paddingRight: theme.size.heroBadge + theme.size.heroBadgeRight - theme.spacing.screenEdge,
    },
    heroTag: {
      alignSelf: 'flex-start',
      paddingVertical: theme.spacing.xs,
      paddingHorizontal: theme.spacing.grid,
      borderWidth: theme.size.borderThin,
      borderColor: theme.palette.textSoft,
      borderRadius: theme.radius.md,
    },
    heroNumber: { paddingTop: theme.spacing.xs },
    heroAction: { marginTop: theme.spacing.sm },
    tiles: { gap: theme.spacing.grid },
    tileRow: { flexDirection: 'row', gap: theme.spacing.grid },
    actions: { gap: theme.spacing.md },
    muted: { ...theme.type.detail, color: theme.palette.textSoft },
    strip: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.md },
    stat: { minWidth: theme.size.touchTargetLarge, alignItems: 'flex-start' },
    panel: { borderRadius: theme.radius.card, padding: theme.spacing.lg, gap: theme.spacing.md },
    feedTint: { backgroundColor: theme.palette.feed },
    sleepTint: { backgroundColor: theme.palette.sleep },
    onTile: { color: theme.palette.onTile },
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
