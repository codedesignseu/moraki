import { useState } from 'react';

import { useEvents, useEventsRepository } from '@/db/react';
import { useUndoableSaves } from '@/db/undo';
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
  const saves = useUndoableSaves(repository);
  const events = useEvents();
  const tz = deviceTimeZone();
  const [openedAt] = useState(Date.now);
  const running = selectHomeState(events, openedAt, tz, DEFAULT_HOME_SETTINGS).activeSleep;

  const [startedAgo, setStartedAgo] = useState<number>(PAST_SLEEP.startedAgo.initial);
  const [duration, setDuration] = useState<number>(PAST_SLEEP.duration.initial);
  // A past sleep ends by the time the sheet opened.
  // Set outright when someone writes a sleep up afterwards and knows the two
  // times (P3-F7). Null means the steppers below are the answer, which is the
  // fast path for "she went down about an hour ago".
  const [exactStart, setExactStart] = useState<number | null>(null);
  const [exactEnd, setExactEnd] = useState<number | null>(null);

  const maxDuration = startedAgo;
  const start = exactStart ?? openedAt - startedAgo * MINUTE_MS;
  const end = exactEnd ?? start + Math.min(duration, maxDuration) * MINUTE_MS;

  return {
    running: running && { id: running.id, startedAt: formatClock(running.occurredAt, tz) },
    startNow: () =>
      saves.insert('undo.sleepStarted', { type: 'sleep', occurredAt: openedAt, payload: {} }),
    stop: (id: string) =>
      saves.patch('undo.sleepStopped', [{ id, changes: { endedAt: Date.now() } }]),
    past: {
      startedAgo,
      setStartedAgo: (minutes: number) => {
        setStartedAgo(minutes);
        setDuration((current) => Math.min(current, minutes));
      },
      duration: Math.min(duration, maxDuration),
      /** Both ends, for setting them directly rather than as an offset. */
      start,
      end,
      setStart: (at: number) => {
        setExactStart(at);
        // An end still measured from the old start would jump; keep the
        // length the steppers say unless it was set outright too.
        if (exactEnd !== null && exactEnd <= at) setExactEnd(null);
      },
      setEnd: setExactEnd,
      /** A sleep must end after it starts; the sheet says so rather than saving it. */
      endsBeforeItStarts: end <= start,
      setDuration,
      maxDuration,
      from: formatClock(start, tz),
      to: formatClock(end, tz),
      save: () =>
        saves.insert('undo.sleepSaved', {
          type: 'sleep',
          occurredAt: start,
          endedAt: end,
          payload: {},
        }),
    },
  };
}
