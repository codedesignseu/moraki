import { useState } from 'react';

import { useEvents, useEventsRepository } from '@/db/react';
import { useUndoableSaves } from '@/db/undo';
import { pumpPrefill, type PumpPrefill } from '@/domain/activities';
import { formatClock } from '@/domain/time/formatClock';
import { deviceTimeZone } from '@/ui/deviceTimeZone';

export type PumpForm = PumpPrefill;

/**
 * The pump sheet's state (SDD 7): opens with the last session's amount and
 * where it went, and the time it opened, so a repeat session is two taps.
 * Where it goes decides whether it joins the stock fold (SDD 6.3).
 */
export function usePumpSheet() {
  const repository = useEventsRepository();
  const saves = useUndoableSaves(repository);
  const events = useEvents();
  const tz = deviceTimeZone();
  const [openedAt] = useState(Date.now);
  const [form, setForm] = useState<PumpForm>(() => pumpPrefill(events));

  return {
    form,
    at: formatClock(openedAt, tz),
    update: (changes: Partial<PumpForm>) => setForm((current) => ({ ...current, ...changes })),
    save: () =>
      saves.insert('undo.pumpSaved', {
        type: 'pump',
        occurredAt: openedAt,
        payload: { ml: form.ml, dest: form.dest },
      }),
  };
}
