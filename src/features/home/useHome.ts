import { useMemo } from 'react';

import { useCaregiverNames, useEvents, useEventsRepository } from '@/db/react';
import { useUndoableSaves } from '@/db/undo';
import { describeEntry, type EntryRow } from '@/domain/entries/describeEntry';
import { selectHomeState } from '@/domain/home/homeState';
import { milkAge, type MilkAge } from '@/domain/stock/milkAge';
import { selectStock } from '@/domain/stock/stockState';
import { formatClock } from '@/domain/time/formatClock';
import { formatElapsed } from '@/domain/time/formatElapsed';

import { useReminderSettings } from '@/sync/useReminderSettings';
import { deviceTimeZone } from '@/ui/deviceTimeZone';
import { useNow } from '@/ui/useNow';

export const TIMER_TICK_MS = 30_000;
const RECENT_COUNT = 6;

export type RecentRow = EntryRow;

export type ActiveSleep = { id: string; elapsed: string; startedAt: string };

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
      stock: { fridge: place(stock.fridge), freezer: place(stock.freezer) },
      recent: events.slice(0, RECENT_COUNT).map((e) => describeEntry(e, now, tz, me, names)),
      lastEntryBy:
        state.lastEntry === null
          ? null
          : state.lastEntry.by === me
            ? null
            : (names.get(state.lastEntry.by) ?? null),
    };
  }, [events, now, tz, repository, saves, names, settings]);
}
