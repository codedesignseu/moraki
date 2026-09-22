import { useState } from 'react';

import { useEvents, useEventsRepository } from '@/db/react';
import { DEFAULT_HOME_SETTINGS, selectHomeState } from '@/domain/home/homeState';
import { formatClock } from '@/domain/time/formatClock';
import { deviceTimeZone } from '@/ui/deviceTimeZone';

const MINUTE_MS = 60_000;

export const PAST_SLEEP = {
  step: 5,
  /** Minutes before the sheet opened. */
  startedAgo: { initial: 60, min: 5, max: 24 * 60 },
  duration: { initial: 45, min: 5 },
} as const;

/**
 * Start a sleep now, stop the running one, or add one that already happened.
 * A running sleep is just a sleep event with no end time: nothing about it is
 * held in memory, so it is still there after the app is killed.
 */
export function useSleepSheet() {
  const repository = useEventsRepository();
  const events = useEvents();
  const tz = deviceTimeZone();
  const [openedAt] = useState(Date.now);
  const running = selectHomeState(events, openedAt, tz, DEFAULT_HOME_SETTINGS).activeSleep;

  const [startedAgo, setStartedAgo] = useState<number>(PAST_SLEEP.startedAgo.initial);
  const [duration, setDuration] = useState<number>(PAST_SLEEP.duration.initial);
  // A past sleep ends by the time the sheet opened.
  const maxDuration = startedAgo;
  const start = openedAt - startedAgo * MINUTE_MS;
  const end = start + Math.min(duration, maxDuration) * MINUTE_MS;

  return {
    running: running && { id: running.id, startedAt: formatClock(running.occurredAt, tz) },
    startNow: () => repository.insert({ type: 'sleep', occurredAt: openedAt, payload: {} }),
    stop: (id: string) => repository.patch(id, { endedAt: Date.now() }),
    past: {
      startedAgo,
      setStartedAgo: (minutes: number) => {
        setStartedAgo(minutes);
        setDuration((current) => Math.min(current, minutes));
      },
      duration: Math.min(duration, maxDuration),
      setDuration,
      maxDuration,
      from: formatClock(start, tz),
      to: formatClock(end, tz),
      save: () =>
        repository.insert({ type: 'sleep', occurredAt: start, endedAt: end, payload: {} }),
    },
  };
}
