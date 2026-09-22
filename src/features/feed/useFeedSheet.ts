import { useState } from 'react';

import { useEvents, useEventsRepository } from '@/db/react';
import { feedPrefill, type FeedPrefill } from '@/domain/activities';
import { DEFAULT_HOME_SETTINGS, selectHomeState } from '@/domain/home/homeState';
import { formatClock } from '@/domain/time/formatClock';

import { deviceTimeZone } from '@/ui/deviceTimeZone';

export type FeedForm = FeedPrefill;

/**
 * The feed sheet's state, opened with the last-used values and the current time
 * (SDD 7), so a repeat bottle feed is Log feed, then Save.
 */
export function useFeedSheet() {
  const repository = useEventsRepository();
  const events = useEvents();
  const tz = deviceTimeZone();
  const [openedAt] = useState(Date.now);
  const [form, setForm] = useState<FeedForm>(() =>
    feedPrefill(events, selectHomeState(events, openedAt, tz, DEFAULT_HOME_SETTINGS).nextSide),
  );

  function save() {
    const bottle = {
      type: 'feed_bottle' as const,
      occurredAt: openedAt,
      payload: { ml: form.ml, milk: form.milk },
    };
    const breast = {
      type: 'feed_breast' as const,
      occurredAt: openedAt,
      payload: { side: form.side },
    };
    if (form.kind === 'mixed') repository.insertGroup([bottle, breast]);
    else repository.insert(form.kind === 'bottle' ? bottle : breast);
  }

  return {
    form,
    time: formatClock(openedAt, tz),
    update: (changes: Partial<FeedForm>) => setForm((current) => ({ ...current, ...changes })),
    save,
  };
}
