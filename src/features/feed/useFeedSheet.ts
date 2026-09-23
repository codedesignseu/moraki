import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useEvents, useEventsRepository } from '@/db/react';
import type { EventChanges } from '@/db/repositories/events';
import { useUndoableSaves } from '@/db/undo';
import { feedEditTarget, feedPrefill, type FeedPrefill } from '@/domain/activities';
import { DEFAULT_HOME_SETTINGS, selectHomeState } from '@/domain/home/homeState';
import { selectStock } from '@/domain/stock/stockState';
import { formatClock } from '@/domain/time/formatClock';
import { formatDateTime } from '@/domain/time/formatDateTime';
import { dateLocale } from '@/i18n';
import { deviceTimeZone } from '@/ui/deviceTimeZone';

export type FeedForm = FeedPrefill;

const MINUTE_MS = 60_000;

/**
 * The feed sheet's state. Logging opens with the last-used values and the
 * current time (SDD 7), so a repeat bottle feed is Log feed, then Save. With
 * `entryId` it edits that feed instead (P1-12): a mixed feed's two parts
 * together, its time moved with the time stepper, its kind fixed.
 */
export function useFeedSheet(entryId?: string) {
  const repository = useEventsRepository();
  const saves = useUndoableSaves(repository);
  const events = useEvents();
  const tz = deviceTimeZone();
  const { i18n } = useTranslation();
  const [openedAt] = useState(Date.now);
  const [target] = useState(() => {
    const entry = entryId ? repository.get(entryId) : null;
    if (!entry) return null;
    const parts =
      entry.groupId === null ? [entry] : events.filter((e) => e.groupId === entry.groupId);
    return feedEditTarget(parts);
  });
  const [form, setForm] = useState<FeedForm>(
    () =>
      target?.form ??
      feedPrefill(events, selectHomeState(events, openedAt, tz, DEFAULT_HOME_SETTINGS).nextSide),
  );
  const [shift, setShift] = useState(0);

  function save() {
    if (target) {
      saveEdit(target);
      return;
    }
    // A breastfeed is logged when it ends: it started "Fed for" minutes before
    // the sheet opened (P1-19). A mixed feed is one session, so its bottle part
    // starts then too, and "since last feed" counts from the start either way.
    const hasBreast = form.kind !== 'bottle';
    const start = hasBreast ? openedAt - form.breastMinutes * MINUTE_MS : openedAt;
    const bottle = {
      type: 'feed_bottle' as const,
      occurredAt: start,
      payload: {
        ml: form.ml,
        milk: form.milk,
        ...(form.fromStock !== null && { from_stock: form.fromStock }),
      },
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

  function saveEdit({ start, bottle, breast }: NonNullable<typeof target>) {
    const newStart = start + shift * MINUTE_MS;
    const edits: { id: string; changes: EventChanges }[] = [];
    if (bottle) {
      const was = bottle.payload.from_stock ?? null;
      const payload = {
        ...(form.ml !== bottle.payload.ml && { ml: form.ml }),
        ...(form.milk !== bottle.payload.milk && { milk: form.milk }),
        ...(form.fromStock !== was && form.fromStock !== null && { from_stock: form.fromStock }),
      };
      // Taking the bottle off a store removes the key, so the stock fold stops
      // counting it rather than keeping a stale place.
      const unset = form.fromStock === null && was !== null ? ['from_stock'] : [];
      edits.push({
        id: bottle.id,
        changes: {
          ...(Object.keys(payload).length > 0 && { payload }),
          ...(unset.length > 0 && { unset }),
          ...(newStart !== bottle.occurredAt && { occurredAt: newStart }),
        },
      });
    }
    if (breast) {
      const endedAt = newStart + form.breastMinutes * MINUTE_MS;
      edits.push({
        id: breast.id,
        changes: {
          ...(form.side !== breast.payload.side && { payload: { side: form.side } }),
          ...(newStart !== breast.occurredAt && { occurredAt: newStart }),
          ...(endedAt !== breast.endedAt && { endedAt }),
        },
      });
    }
    const changed = edits.filter((edit) => Object.keys(edit.changes).length > 0);
    if (changed.length > 0) saves.patch('undo.entryUpdated', changed);
  }

  return {
    form,
    editing: target !== null,
    /** What is in each store right now, for the "from" choice (SDD 6.3). */
    stock: selectStock(events),
    /** "At 14:05" for a bottle; "13:50 to 14:05" when a breastfeed's start is back-dated. */
    when:
      form.kind === 'bottle'
        ? { at: formatClock(openedAt, tz) }
        : {
            from: formatClock(openedAt - form.breastMinutes * MINUTE_MS, tz),
            to: formatClock(openedAt, tz),
          },
    /** Editing only: the time stepper and the feed's new start. */
    shift,
    setShift,
    newStart: target
      ? formatDateTime(target.start + shift * MINUTE_MS, tz, dateLocale(i18n.language))
      : '',
    update: (changes: Partial<FeedForm>) =>
      setForm((current) => {
        const next = { ...current, ...changes };
        // Formula doesn't come out of the fridge, so switching to it clears
        // the store rather than quietly draining one.
        return next.milk === 'formula' ? { ...next, fromStock: null } : next;
      }),
    save,
  };
}
