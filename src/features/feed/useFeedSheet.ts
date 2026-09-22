import { useState } from 'react';

import { useEvents, useEventsRepository } from '@/db/react';
import { useUndoableSaves } from '@/db/undo';
import { feedPrefill, type FeedPrefill } from '@/domain/activities';
import { DEFAULT_HOME_SETTINGS, selectHomeState } from '@/domain/home/homeState';
import { formatClock } from '@/domain/time/formatClock';

import { deviceTimeZone } from '@/ui/deviceTimeZone';

export type FeedForm = FeedPrefill;

const MINUTE_MS = 60_000;

/**
 * The feed sheet's state, opened with the last-used values and the current time
 * (SDD 7), so a repeat bottle feed is Log feed, then Save.
 */
export function useFeedSheet() {
  const repository = useEventsRepository();
  const saves = useUndoableSaves(repository);
  const events = useEvents();
  const tz = deviceTimeZone();
  const [openedAt] = useState(Date.now);
  const [form, setForm] = useState<FeedForm>(() =>
    feedPrefill(events, selectHomeState(events, openedAt, tz, DEFAULT_HOME_SETTINGS).nextSide),
  );

  function save() {
    // A breastfeed is logged when it ends: it started "Fed for" minutes before
    // the sheet opened (P1-19). A mixed feed is one session, so its bottle part
    // starts then too, and "since last feed" counts from the start either way.
    const hasBreast = form.kind !== 'bottle';
    const start = hasBreast ? openedAt - form.breastMinutes * MINUTE_MS : openedAt;
    const bottle = {
      type: 'feed_bottle' as const,
      occurredAt: start,
      payload: { ml: form.ml, milk: form.milk },
    };
    const breast = {
      type: 'feed_breast' as const,
      occurredAt: start,
      endedAt: openedAt,
      payload: { side: form.side },
    };
    saves.insert(
      'undo.feedSaved',
      form.kind === 'mixed' ? [bottle, breast] : form.kind === 'bottle' ? bottle : breast,
    );
  }

  return {
    form,
    /** "At 14:05" for a bottle; "13:50 to 14:05" when a breastfeed's start is back-dated. */
    when:
      form.kind === 'bottle'
        ? { at: formatClock(openedAt, tz) }
        : {
            from: formatClock(openedAt - form.breastMinutes * MINUTE_MS, tz),
            to: formatClock(openedAt, tz),
          },
    update: (changes: Partial<FeedForm>) => setForm((current) => ({ ...current, ...changes })),
    save,
  };
}
