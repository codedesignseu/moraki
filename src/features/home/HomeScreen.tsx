import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { getActivity, HOME_TILES, type HomeTile } from '@/domain/activities';
import { formatStopwatch } from '@/domain/time/formatStopwatch';
import {
  ActivityTile,
  Button,
  Card,
  Icon,
  IconCircle,
  ListGroup,
  ListRow,
  Logo,
  PillButton,
  StatCell,
  TextButton,
  TimerText,
} from '@/ui/primitives';
import { useTheme, type Theme } from '@/ui/theme';
import { useNow } from '@/ui/useNow';

import { useHome, type HomeViewModel, type RecentRow, type StockPlaceView } from './useHome';

type Translate = (key: string, values?: Record<string, string | number>) => string;

/** What Home can open a log sheet for: the four tiles, then the health rows. */
export type LogKind = 'feed' | 'sleep' | 'diaper' | 'pump' | 'health' | 'medication';

/** The running sleep's timer ticks every second, and only while a sleep runs. */
export const SLEEP_TICK_MS = 1000;

/** Renders the home view model and nothing else (SDD 15.4). */
export function HomeScreen({
  onLog,
  onOpenEntry,
  onAdjustStock,
  onAppointment,
  onJoin,
}: {
  /** Opens a log sheet. Supplied by app/, which owns navigation. */
  onLog?: (kind: LogKind) => void;
  /** Opens an entry to edit (P1-12). Supplied by app/ so features stay independent. */
  onOpenEntry?: (id: string) => void;
  /** Opens the adjust sheet for a store (P3-03). */
  onAdjustStock?: (place: 'fridge' | 'freezer') => void;
  /** Opens an appointment to edit, or the sheet to add one (P3-12). */
  onAppointment?: (id?: string) => void;
  /** Opens joining by code, offered while nothing is logged and the phone is in no household. */
  onJoin?: () => void;
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
        <Card
          variant="hero"
          icon="feed"
          iconTone="feed"
          message={t('home.duplicate.question', {
            name: home.duplicate.by,
            time: home.duplicate.time,
          })}
          testID="home-duplicate"
        >
          <View style={s.pair}>
            <View style={s.flex}>
              <Button
                label={t('home.duplicate.same')}
                onPress={() => home.removeDuplicate(home.duplicate?.id ?? '')}
              />
            </View>
            <View style={s.flex}>
              <Button
                label={t('home.duplicate.keepBoth')}
                variant="secondary"
                onPress={() => home.keepBoth(home.duplicate?.id ?? '')}
              />
            </View>
          </View>
        </Card>
      )}

      {home.activeSleep && (
        <SleepCard
          sleep={home.activeSleep}
          t={t}
          onStop={() => home.activeSleep && home.stopSleep(home.activeSleep.id)}
        />
      )}

      {onLog && <Tiles tiles={home.tiles} t={t} onLog={onLog} />}

      {/* G3: Home keeps all its cards when nothing is logged; this is G's empty hint. */}
      {onLog && home.recent.length === 0 && (
        <Text style={[theme.type.detail, s.soft, s.centre]}>{t('home.emptyHint')}</Text>
      )}
      {onLog && onJoin && home.recent.length === 0 && (
        <TextButton label={t('home.joinWithCode')} align="center" onPress={onJoin} />
      )}

      {onLog && (
        <ListGroup testID="home-health">
          <ListRow
            grouped
            title={t('home.actions.health')}
            icon={getActivity('health')?.icon ?? 'health'}
            badge={getActivity('health')?.tone ?? 'sleep'}
            onPress={() => onLog('health')}
          />
          <ListRow
            grouped
            title={t('home.actions.medication')}
            icon={getActivity('medication')?.icon ?? 'health'}
            badge={getActivity('medication')?.tone ?? 'pump'}
            onPress={() => onLog('medication')}
          />
        </ListGroup>
      )}

      <Card testID="home-today">
        <Text accessibilityRole="header" style={[theme.type.cardTitle, s.ink]}>
          {t('home.today.title')}
        </Text>
        <View style={s.cells}>
          <StatCell tone="feed" value={home.today.feeds} label={t('home.today.feeds')} />
          <StatCell tone="diaper" value={home.today.diapers} label={t('home.today.diapers')} />
          <StatCell tone="sleep" value={home.today.sleepHours} label={t('home.today.sleepHours')} />
          <StatCell tone="pump" value={home.today.ml} label={t('home.today.ml')} />
        </View>
        {/* The app's figures that G's four cells leave out (G3: no data is removed). */}
        <Text style={[theme.type.note, s.soft]}>
          {t('home.today.detail', {
            wet: home.today.wet,
            dirty: home.today.dirty,
            breastfeeding: home.today.breastfeeding,
          })}
        </Text>
        <Text style={[theme.type.note, s.soft]}>
          {t('home.today.sleep24h', { duration: home.today.sleep })}
        </Text>
      </Card>

      <Appointment home={home} t={t} onAppointment={onAppointment} />

      <Card variant="hero" testID="home-stock">
        <View style={s.between}>
          <View style={s.titleRow}>
            <IconCircle icon="pump" tone="pump" />
            <Text accessibilityRole="header" style={[theme.type.cardTitle, s.ink]}>
              {t('home.stock.title')}
            </Text>
          </View>
          {onAdjustStock && (
            <PillButton
              variant="outlined"
              label={t('home.stock.adjust')}
              onPress={() => onAdjustStock('fridge')}
            />
          )}
        </View>
        <View style={s.pair}>
          <Place
            name={t('home.stock.fridge')}
            place={home.stock.fridge}
            t={t}
            {...(onAdjustStock && { onAdjust: () => onAdjustStock('fridge') })}
          />
          <Place
            name={t('home.stock.freezer')}
            place={home.stock.freezer}
            t={t}
            {...(onAdjustStock && { onAdjust: () => onAdjustStock('freezer') })}
          />
        </View>
        <PlaceNotes name={t('home.stock.fridge')} place={home.stock.fridge} t={t} />
        <PlaceNotes name={t('home.stock.freezer')} place={home.stock.freezer} t={t} />
      </Card>

      <Card variant="hero" testID="home-recent">
        <Text accessibilityRole="header" style={[theme.type.cardTitle, s.ink]}>
          {t('home.recent.title')}
        </Text>
        {home.lastEntryBy && (
          <Text style={[theme.type.note, s.soft]}>
            {t('home.recent.lastBy', { name: home.lastEntryBy })}
          </Text>
        )}
        {home.recent.length === 0 ? (
          <Text style={[theme.type.note, s.soft]}>{t('home.recent.empty')}</Text>
        ) : (
          <View>
            {home.recent.map((row, index) => (
              <View key={row.id}>
                {index > 0 && <View style={s.divider} />}
                <Row row={row} t={t} onOpen={onOpenEntry} />
              </View>
            ))}
          </View>
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

/**
 * G running-sleep card (tabs/home-states): "Sleeping since 21:40", a live
 * h:mm:ss timer, and a card-colour "Stop the sleep timer" pill.
 */
function SleepCard({
  sleep,
  t,
  onStop,
}: {
  sleep: NonNullable<HomeViewModel['activeSleep']>;
  t: Translate;
  onStop: () => void;
}) {
  const theme = useTheme();
  const s = styles(theme);
  // Mounted only while a sleep runs, so Home's 30 s tick stays as it is.
  const now = useNow(SLEEP_TICK_MS);
  return (
    <View style={s.sleep} testID="home-sleep">
      <View style={s.sleepCircle} pointerEvents="none" />
      <View style={s.between}>
        <View style={s.flex}>
          <Text style={[theme.type.greeting, s.ink]}>{t('home.sleep.title')}</Text>
          <Text style={[theme.type.note, s.soft]}>
            {t('home.sleep.since', { time: sleep.startedAt })}
          </Text>
        </View>
        <Text accessibilityRole="timer" style={[theme.type.title, s.ink, s.figures]}>
          {formatStopwatch(now - sleep.startedAtMs)}
        </Text>
      </View>
      <Pressable
        onPress={onStop}
        accessibilityRole="button"
        accessibilityLabel={t('home.sleep.stop')}
        style={({ pressed }) => [s.stop, pressed && s.pressed]}
      >
        <Text style={[theme.type.detailBold, s.ink]}>{t('home.sleep.stop')}</Text>
        <View style={s.stopBadge}>
          <Icon name="stop" size={theme.size.iconField} color={theme.palette.onButtonPrimary} />
        </View>
      </Pressable>
    </View>
  );
}

/** G appointment card: one row with the next visit, or the app's "Nothing booked". */
function Appointment({
  home,
  t,
  onAppointment,
}: {
  home: HomeViewModel;
  t: Translate;
  onAppointment?: ((id?: string) => void) | undefined;
}) {
  const theme = useTheme();
  const s = styles(theme);
  const next = home.appointment;
  const body = (
    <>
      <IconCircle icon="visit" tone="diaper" size="control" />
      <View style={s.flex}>
        <Text style={[theme.type.statLabel, s.soft]}>{t('home.appointment.title')}</Text>
        <Text style={[theme.type.cardTitle, s.ink]}>
          {next ? next.title : t('home.appointment.none')}
        </Text>
        {next && (
          <Text style={[theme.type.note, s.soft]}>
            {next.doctor
              ? t('home.appointment.whenWith', { when: next.when, doctor: next.doctor })
              : next.when}
          </Text>
        )}
      </View>
      {next && onAppointment && (
        <Icon name="chevron" size={theme.size.iconField} color={theme.palette.textSoft} />
      )}
    </>
  );
  return (
    <Card variant="hero" testID="home-appointment">
      {next && onAppointment ? (
        <Pressable
          testID={`appointment-${next.id}`}
          accessibilityRole="button"
          onPress={() => onAppointment(next.id)}
          style={({ pressed }) => [s.titleRow, pressed && s.pressed]}
        >
          {body}
        </Pressable>
      ) : (
        <View style={s.titleRow} {...(next && { testID: `appointment-${next.id}` })}>
          {body}
        </View>
      )}
      {onAppointment && (
        <PillButton
          variant="outlined"
          icon="plus"
          label={t('home.appointment.add')}
          onPress={() => onAppointment()}
        />
      )}
    </Card>
  );
}

/** One milk store as a G stock cell; pressing it adjusts that store. */
function Place({
  name,
  place,
  t,
  onAdjust,
}: {
  name: string;
  place: StockPlaceView;
  t: Translate;
  onAdjust?: (() => void) | undefined;
}) {
  const theme = useTheme();
  const s = styles(theme);
  const cell = (
    <StatCell
      layout="labelFirst"
      tone="pump"
      label={name}
      value={t('home.stock.amount', { ml: place.ml })}
    />
  );
  if (!onAdjust) return <View style={s.flex}>{cell}</View>;
  return (
    <Pressable
      onPress={onAdjust}
      accessibilityRole="button"
      accessibilityLabel={t('home.stock.adjustPlace', { place: name })}
      accessibilityValue={{ text: t('home.stock.amount', { ml: place.ml }) }}
      style={({ pressed }) => [s.flex, pressed && s.pressed]}
    >
      {cell}
    </Pressable>
  );
}

/** How old a store's oldest milk is, and the app's "check the count" warning. */
function PlaceNotes({ name, place, t }: { name: string; place: StockPlaceView; t: Translate }) {
  const theme = useTheme();
  const s = styles(theme);
  return (
    <>
      {place.age && (
        <Text style={[theme.type.note, s.soft]}>
          {t(`home.stock.oldest.${place.age.scale}`, { place: name, count: place.age.value })}
        </Text>
      )}
      {/* A count that has gone past empty is a count to check, not a number
          to trust, so the way to fix it sits right next to it (SDD 6.3). */}
      {place.short && (
        <Text style={[theme.type.note, s.soft]}>{t('home.stock.short', { place: name })}</Text>
      )}
    </>
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
  const label = t(row.labelKey);
  const title = row.summary
    ? t('home.recent.rowSummary', { when, label, summary: t(row.summary.key, row.summary.values) })
    : t('home.recent.row', { when, label });
  return (
    <ListRow
      grouped
      testID={`recent-${row.id}`}
      icon={row.icon}
      badge={row.tone}
      title={title}
      detail={row.byYou ? t('home.recent.you') : (row.by ?? t('home.recent.other'))}
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
    centre: { textAlign: 'center' },
    flex: { flex: 1 },
    figures: { fontVariant: ['tabular-nums'] },
    pressed: { opacity: theme.opacity.pressed },
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
    pair: { flexDirection: 'row', gap: theme.spacing.grid },
    cells: { flexDirection: 'row', gap: theme.spacing.xs },
    titleRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md },
    between: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: theme.spacing.grid,
    },
    divider: { height: theme.size.borderThin, backgroundColor: theme.palette.line },
    sleep: {
      overflow: 'hidden',
      borderRadius: theme.radius.hero,
      paddingTop: theme.spacing.lg,
      paddingBottom: theme.spacing.field,
      paddingHorizontal: theme.spacing.screenEdge,
      gap: theme.spacing.field,
      backgroundColor: theme.palette.sleep,
    },
    // G: a card-colour circle at 45% behind the top right corner. Decoration.
    sleepCircle: {
      position: 'absolute',
      top: -theme.size.sleepCircleTop,
      right: -theme.size.sleepCircleRight,
      width: theme.size.sleepCircle,
      height: theme.size.sleepCircle,
      borderRadius: theme.radius.pill,
      backgroundColor: theme.palette.card,
      opacity: theme.opacity.decoration,
    },
    stop: {
      minHeight: theme.size.sleepStop,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingLeft: theme.spacing.screenEdge,
      paddingRight: theme.spacing.sm,
      borderRadius: theme.radius.pill,
      backgroundColor: theme.palette.card,
    },
    stopBadge: {
      width: theme.size.sleepStopBadge,
      height: theme.size.sleepStopBadge,
      borderRadius: theme.radius.pill,
      backgroundColor: theme.palette.buttonPrimary,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
