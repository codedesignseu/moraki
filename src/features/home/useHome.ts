import { useMemo } from 'react';

import { useCaregiverNames, useEvents, useEventsRepository } from '@/db/react';
import { useUndoableSaves } from '@/db/undo';
import { describeEntry, type EntryRow } from '@/domain/entries/describeEntry';
import { DEFAULT_HOME_SETTINGS, selectHomeState } from '@/domain/home/homeState';
import { formatClock } from '@/domain/time/formatClock';
import { formatElapsed } from '@/domain/time/formatElapsed';

import { deviceTimeZone } from '@/ui/deviceTimeZone';
import { useNow } from '@/ui/useNow';

export const TIMER_TICK_MS = 30_000;
const RECENT_COUNT = 6;

export type RecentRow = EntryRow;

export type ActiveSleep = { id: string; elapsed: string; startedAt: string };

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

  return useMemo(() => {
    const state = selectHomeState(events, now, tz, DEFAULT_HOME_SETTINGS);
    const me = repository.currentUserId();
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
      recent: events.slice(0, RECENT_COUNT).map((e) => describeEntry(e, now, tz, me, names)),
      lastEntryBy:
        state.lastEntry === null
          ? null
          : state.lastEntry.by === me
            ? null
            : (names.get(state.lastEntry.by) ?? null),
    };
  }, [events, now, tz, repository, saves, names]);
}
