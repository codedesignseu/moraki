import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { useCaregiverNames, useDevicePref, useEvents, useEventsRepository } from '@/db/react';
import { useUndoableSaves } from '@/db/undo';
import { nextAppointment } from '@/domain/activities';
import { findDuplicateFeeds } from '@/domain/duplicates/duplicateFeeds';
import { describeEntry, type EntryRow } from '@/domain/entries/describeEntry';
import { selectHomeState } from '@/domain/home/homeState';
import { milkAge, type MilkAge } from '@/domain/stock/milkAge';
import { selectStock } from '@/domain/stock/stockState';
import { formatClock } from '@/domain/time/formatClock';
import { formatDateTime } from '@/domain/time/formatDateTime';
import { formatElapsed } from '@/domain/time/formatElapsed';

import { dateLocale } from '@/i18n';
import { useReminderSettings } from '@/sync/useReminderSettings';
import { deviceTimeZone } from '@/ui/deviceTimeZone';
import { useNow } from '@/ui/useNow';

export const TIMER_TICK_MS = 30_000;
const RECENT_COUNT = 6;

export type RecentRow = EntryRow;

export type ActiveSleep = { id: string; elapsed: string; startedAt: string };

export type NextAppointment = { id: string; title: string; when: string };

/** "Nik also logged a feed at 03:14. Same feed?" (SDD 5.6). */
export type DuplicateQuestion = { id: string; by: string; time: string };

export type StockPlaceView = {
  ml: number;
  /** The age of the oldest batch left, or null when the place is empty. */
  age: MilkAge | null;
  /** More has gone out than went in, so the count needs checking (SDD 6.3). */
  short: boolean;
};

export type HomeViewModel = {
  sinceLastFeed: string | null;
  nextSide: 'left' | 'right' | null;
  reminder: { time: string; passed: boolean } | null;
  /** Bottle mL and breastfeeding time are separate figures, never combined. */
  today: {
    feeds: number;
    ml: number;
    breastfeeding: string;
    wet: number;
    dirty: number;
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
  const { t, i18n } = useTranslation();
  const locale = dateLocale(i18n.language);

  return useMemo(() => {
    const state = selectHomeState(events, now, tz, {
      reminderIntervalMin: settings.intervalMin,
      secondReminderMin: settings.secondReminderMin,
    });
    const me = repository.currentUserId();
    const stock = selectStock(events);
    const place = (p: (typeof stock)['fridge']): StockPlaceView => ({
      ml: p.ml,
      age: p.oldestAt === null ? null : milkAge(p.oldestAt, now),
      short: p.short,
    });
    return {
      sinceLastFeed: state.sinceLastFeedMs === null ? null : formatElapsed(state.sinceLastFeedMs),
      nextSide: state.nextSide,
      reminder:
        state.reminderAt === null
          ? null
          : { time: formatClock(state.reminderAt, tz), passed: state.reminderAt <= now },
      today: {
        feeds: state.today.feeds,
        ml: state.today.ml,
        breastfeeding: formatElapsed(state.today.breastMs),
        wet: state.today.wet,
        dirty: state.today.dirty,
        sleep: formatElapsed(state.today.sleepMs24h),
      },
      activeSleep:
        state.activeSleep === null
          ? null
          : {
              id: state.activeSleep.id,
              elapsed: formatElapsed(now - state.activeSleep.occurredAt),
              startedAt: formatClock(state.activeSleep.occurredAt, tz),
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
  }, [events, now, tz, repository, saves, names, settings, locale, t, kept, setKept]);
}
