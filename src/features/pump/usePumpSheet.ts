import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useEvents, useEventsRepository } from '@/db/react';
import { useUndoableSaves } from '@/db/undo';
import { pumpPrefill, type PumpPrefill } from '@/domain/activities';
import { formatDateTime } from '@/domain/time/formatDateTime';
import { dateLocale } from '@/i18n';
import { deviceTimeZone } from '@/ui/deviceTimeZone';

export type PumpForm = PumpPrefill;

/**
 * The pump sheet's state (SDD 7): opens with the last session's amount and
 * where it went, and the time it opened, so a repeat session is two taps.
 * A session written up afterwards can be given its own time (P3-F10).
 * Where it goes decides whether it joins the stock fold (SDD 6.3).
 */
export function usePumpSheet() {
  const repository = useEventsRepository();
  const saves = useUndoableSaves(repository);
  const events = useEvents();
  const { i18n } = useTranslation();
  const tz = deviceTimeZone();
  const [openedAt] = useState(Date.now);
  const [at, setAt] = useState(openedAt);
  const [form, setForm] = useState<PumpForm>(() => pumpPrefill(events));

  return {
    form,
    /** The moment the session is recorded at, and the words for it. */
    at,
    atLabel: formatDateTime(at, tz, dateLocale(i18n.language)),
    setAt,
    update: (changes: Partial<PumpForm>) => setForm((current) => ({ ...current, ...changes })),
    save: () =>
      saves.insert('undo.pumpSaved', {
        type: 'pump',
        occurredAt: at,
        payload: { ml: form.ml, dest: form.dest },
      }),
  };
}
