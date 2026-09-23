import { useState } from 'react';

import { useEvents, useEventsRepository } from '@/db/react';
import { useUndoableSaves } from '@/db/undo';
import { isWeight } from '@/domain/activities';
import type { WeightPayload } from '@/domain/activities/weight';

export type WeightForm = { grams: number; source: WeightPayload['source'] };

export const WEIGHT_G = { step: 10, min: 500, max: 15000 } as const;

/** Used only before anything has been weighed and with no birth weight. */
const FIRST_WEIGHT = 3400;

/**
 * The weight sheet: opens at the last weight recorded, since the next one is
 * near it, and asks where the number came from — a home scale and a clinic's
 * rarely agree, and the log says which was which.
 */
export function useWeightSheet(birthWeightG: number | null) {
  const repository = useEventsRepository();
  const saves = useUndoableSaves(repository);
  const events = useEvents();
  const [openedAt] = useState(Date.now);
  const [form, setForm] = useState<WeightForm>(() => {
    const last = events
      .filter((e) => e.deletedAt === null)
      .filter(isWeight)
      .reduce<{ occurredAt: number; grams: number } | null>(
        (best, e) =>
          best === null || e.occurredAt > best.occurredAt
            ? { occurredAt: e.occurredAt, grams: e.payload.grams }
            : best,
        null,
      );
    return { grams: last?.grams ?? birthWeightG ?? FIRST_WEIGHT, source: 'home' };
  });

  return {
    form,
    update: (changes: Partial<WeightForm>) => setForm((current) => ({ ...current, ...changes })),
    save: () =>
      saves.insert('undo.weightSaved', {
        type: 'weight',
        occurredAt: openedAt,
        payload: { grams: form.grams, source: form.source },
      }),
  };
}
