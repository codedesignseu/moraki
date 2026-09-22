import { useMemo } from 'react';

import { useEvents, useEventsRepository } from '@/db/react';
import { getActivity, type EventType, type Summary } from '@/domain/activities';
import { DEFAULT_HOME_SETTINGS, selectHomeState } from '@/domain/home/homeState';
import { formatClock } from '@/domain/time/formatClock';
import { formatElapsed } from '@/domain/time/formatElapsed';
import { dayBucket } from '@/domain/time/zoned';

import { deviceTimeZone } from './deviceTimeZone';
import { useNow } from './useNow';

export const TIMER_TICK_MS = 30_000;
const RECENT_COUNT = 6;

export type RecentRow = {
  id: string;
  type: EventType;
  labelKey: string;
  summary: Summary | null;
  time: string;
  daysAgo: number;
  byYou: boolean;
};

export type HomeViewModel = {
  sinceLastFeed: string | null;
  nextSide: 'left' | 'right' | null;
  reminder: { time: string; passed: boolean } | null;
  today: { feeds: number; ml: number; wet: number; dirty: number; sleep: string };
  recent: RecentRow[];
};

/**
 * The finished home view model (SDD 15.4): HomeScreen renders it and does
 * nothing else. Recomputes on every committed write and every timer tick.
 */
export function useHome(): HomeViewModel {
  const repository = useEventsRepository();
  const events = useEvents();
  const now = useNow(TIMER_TICK_MS);
  const tz = deviceTimeZone();

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
      today: { ...state.today, sleep: formatElapsed(state.today.sleepMs24h) },
      recent: events.slice(0, RECENT_COUNT).map((e) => {
        const module = getActivity(e.type);
        return {
          id: e.id,
          type: e.type,
          labelKey: module?.i18nKey ?? '',
          summary: module?.summarize?.(e) ?? null,
          time: formatClock(e.occurredAt, tz),
          daysAgo: dayBucket(e.occurredAt, now, tz).daysAgo,
          byYou: e.createdBy === me,
        };
      }),
    };
  }, [events, now, tz, repository]);
}
