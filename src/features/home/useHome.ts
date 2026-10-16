import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { useCaregiverNames, useDevicePref, useEvents, useEventsRepository } from '@/db/react';
import { useUndoableSaves } from '@/db/undo';
import { nextAppointment, type HomeTile } from '@/domain/activities';
import { findDuplicateFeeds } from '@/domain/duplicates/duplicateFeeds';
import { describeEntry, type EntryRow } from '@/domain/entries/describeEntry';
import { selectHomeState } from '@/domain/home/homeState';
import { selectHomeTiles, type TileStatus } from '@/domain/home/homeTiles';
import { milkAge, type MilkAge } from '@/domain/stock/milkAge';
import { selectStock } from '@/domain/stock/stockState';
import { formatClock } from '@/domain/time/formatClock';
import { durationParts } from '@/domain/time/durationParts';
import { formatDateTime } from '@/domain/time/formatDateTime';

import { dateLocale } from '@/i18n';
import { formatDuration } from '@/i18n/duration';
import { useReminderSettings } from '@/sync/useReminderSettings';
import { deviceTimeZone } from '@/ui/deviceTimeZone';
import { useNow } from '@/ui/useNow';

export const TIMER_TICK_MS = 30_000;
const RECENT_COUNT = 6;

/** A recent entry with its kind's badge (G recent rows). */
export type RecentRow = EntryRow;

/** The running sleep: when it started, as a clock time and in epoch ms for the live timer. */
export type ActiveSleep = { id: string; startedAt: string; startedAtMs: number };

export type NextAppointment = { id: string; title: string; when: string; doctor: string | null };

/** "Nik also logged a feed at 03:14. Same feed?" (SDD 5.6). */
export type DuplicateQuestion = { id: string; by: string; time: string };

export type StockPlaceView = {
  /** The amount in the app's number format, e.g. "1,150". */
  ml: string;
  /** The age of the oldest batch left, or null when the place is empty. */
  age: MilkAge | null;
  /** More has gone out than went in, so the count needs checking (SDD 6.3). */
  short: boolean;
};

export type HomeViewModel = {
  /**
   * Who is reading and whose day it is (G greeting). Null when this phone has
   * no household or no name for the account, and the greeting goes without.
   */
  greeting: { name: string | null; baby: string | null };
  /** "2 h 15 min" in the app's language, or null before the first feed. */
  sinceLastFeed: string | null;
  /** The line under each tile's name: "Last 21:40", "Awake 1 h 05", "Not yet". */
  tiles: Record<HomeTile, string>;
  nextSide: 'left' | 'right' | null;
  reminder: { time: string; passed: boolean } | null;
  /**
   * Bottle ml and breastfeeding time are separate figures, never combined.
   * Numbers come formatted for the app's language; `sleepHours` is the
   * last 24 hours to one decimal ("11.5"), `sleep` the same in words.
   */
  today: {
    feeds: string;
    diapers: string;
    sleepHours: string;
    ml: string;
    breastfeeding: string;
    wet: string;
    dirty: string;
    sleep: string;
  };
  /**
   * A feed of mine that looks like one the other phone logged (SDD 5.6).
   * Asked, never merged: two caregivers can genuinely feed twice in five
   * minutes, and only the people there know which it was.
   */
  duplicate: DuplicateQuestion | null;
  /** Removes my own entry, the offer the question makes. */
  removeDuplicate: (id: string) => void;
  /** Answers "they were two feeds", and stops asking about this pair. */
  keepBoth: (id: string) => void;
  /** The soonest visit still to come (SDD 7), or null. */
  appointment: NextAppointment | null;
  /** What is in each store, and how old it is (SDD 6.3). */
  stock: { fridge: StockPlaceView; freezer: StockPlaceView };
  recent: RecentRow[];
  /** The other caregiver who logged the newest entry, when it wasn't you. */
  lastEntryBy: string | null;
  activeSleep: ActiveSleep | null;
  /** Ends the running sleep now. */
  stopSleep: (id: string) => void;
};

/**
 * The finished home view model (SDD 15.4): HomeScreen renders it and does
 * nothing else. Recomputes on every committed write and every timer tick.
 */
export function useHome(): HomeViewModel {
  const repository = useEventsRepository();
  const saves = useUndoableSaves(repository);
  const events = useEvents();
  const now = useNow(TIMER_TICK_MS);
  const tz = deviceTimeZone();
  const names = useCaregiverNames();
  // The household's feed interval and optional second reminder (P1-15), so
  // the line on home and the notification are computed from the same numbers.
  const { settings } = useReminderSettings();
  const [kept, setKept] = useDevicePref('keptDuplicates');
  const [household] = useDevicePref('accountHousehold');
  const { t, i18n } = useTranslation();
  const locale = dateLocale(i18n.language);

  return useMemo(() => {
    const state = selectHomeState(events, now, tz, {
      reminderIntervalMin: settings.intervalMin,
      secondReminderMin: settings.secondReminderMin,
    });
    const me = repository.currentUserId();
    const number = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });
    const words = (ms: number) => formatDuration(t, durationParts(ms));
    const tileLine = (tile: HomeTile, status: TileStatus): string => {
      switch (status.kind) {
        case 'none':
          return t('home.tiles.none');
        case 'running':
          return t('home.tiles.running');
        case 'awake':
          return t('home.tiles.awake', {
            duration: formatDuration(t, durationParts(status.sinceMs), 'short'),
          });
        case 'last':
          // A time a little ahead (clock skew) reads as today, like a time today.
          if (status.daysAgo <= 0) {
            return t(`home.tiles.last.${tile}`, { time: formatClock(status.at, tz) });
          }
          return status.daysAgo === 1
            ? t('home.tiles.yesterday')
            : t('home.tiles.daysAgo', { count: status.daysAgo });
      }
    };
    const tiles = selectHomeTiles(events, now, tz);
    const stock = selectStock(events);
    const place = (p: (typeof stock)['fridge']): StockPlaceView => ({
      ml: number.format(p.ml),
      age: p.oldestAt === null ? null : milkAge(p.oldestAt, now),
      short: p.short,
    });
    return {
      greeting: {
        name: household ? (names.get(household.userId) ?? null) : null,
        baby: household?.babyName || null,
      },
      sinceLastFeed:
        state.sinceLastFeedMs === null
          ? null
          : formatDuration(t, durationParts(state.sinceLastFeedMs)),
      tiles: {
        feed: tileLine('feed', tiles.feed),
        sleep: tileLine('sleep', tiles.sleep),
        diaper: tileLine('diaper', tiles.diaper),
        pump: tileLine('pump', tiles.pump),
      },
      nextSide: state.nextSide,
      reminder:
        state.reminderAt === null
          ? null
          : { time: formatClock(state.reminderAt, tz), passed: state.reminderAt <= now },
      today: {
        feeds: number.format(state.today.feeds),
        diapers: number.format(state.today.diapers),
        sleepHours: number.format(Math.round(state.today.sleepMs24h / 360_000) / 10),
        ml: number.format(state.today.ml),
        breastfeeding: words(state.today.breastMs),
        wet: number.format(state.today.wet),
        dirty: number.format(state.today.dirty),
        sleep: words(state.today.sleepMs24h),
      },
      activeSleep:
        state.activeSleep === null
          ? null
          : {
              id: state.activeSleep.id,
              startedAt: formatClock(state.activeSleep.occurredAt, tz),
              startedAtMs: state.activeSleep.occurredAt,
            },
      stopSleep: (id: string) => {
        saves.patch('undo.sleepStopped', [{ id, changes: { endedAt: Date.now() } }]);
      },
      duplicate: (() => {
        const [first] = findDuplicateFeeds(events, me, names, t('home.recent.other')).filter(
          (pair) => !kept.includes(pair.mine.id),
        );
        return first
          ? { id: first.mine.id, by: first.by, time: formatClock(first.theirs.occurredAt, tz) }
          : null;
      })(),
      removeDuplicate: (id: string) => saves.remove('undo.entryDeleted', [id]),
      // Keeping both is an answer, so it is remembered: the same question
      // asked every time the screen redraws would be worse than not asking.
      keepBoth: (id: string) => setKept([...kept.slice(-49), id]),
      appointment: (() => {
        const next = nextAppointment(events, now);
        return next === null
          ? null
          : {
              id: next.id,
              title: next.payload.title,
              when: formatDateTime(next.occurredAt, tz, locale),
              doctor: next.payload.doctor || null,
            };
      })(),
      stock: { fridge: place(stock.fridge), freezer: place(stock.freezer) },
      recent: events.slice(0, RECENT_COUNT).map((e) => describeEntry(e, now, tz, me, names)),
      lastEntryBy:
        state.lastEntry === null
          ? null
          : state.lastEntry.by === me
            ? null
            : (names.get(state.lastEntry.by) ?? null),
    };
  }, [events, now, tz, repository, saves, names, settings, locale, t, kept, setKept, household]);
}
