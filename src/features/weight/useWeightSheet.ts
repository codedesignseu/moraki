import { useState } from 'react';

import { useEvents, useEventsRepository } from '@/db/react';
import { useUndoableSaves } from '@/db/undo';
import { isWeight } from '@/domain/activities';
import { parseGrams, WEIGHT_G, type WeightPayload } from '@/domain/activities/weight';

export type WeightForm = { grams: number; source: WeightPayload['source'] };

export { WEIGHT_G };

/** Used only before anything has been weighed and with no birth weight. */
const FIRST_WEIGHT = 3400;

/**
 * The weight sheet: opens at the last weight recorded, since the next one is
 * near it, and asks where the number came from — a home scale and a clinic's
 * rarely agree, and the log says which was which.
 *
 * The number itself is typed, because it is read off a scale exactly and
 * stepping to it from the last one took dozens of presses (P3-F11). The
 * stepper stays for nudging what was typed. While the text does not read as
 * a weight the form keeps the last good number but refuses to save, so a
 * half-typed "41" is never written down as 41 grams.
 */
export function useWeightSheet(birthWeightG: number | null) {
  const repository = useEventsRepository();
  const saves = useUndoableSaves(repository);
  const events = useEvents();
  const [openedAt] = useState(Date.now);
  // A weight is often copied from a clinic visit days later (P3-F7).
  const [exactAt, setExactAt] = useState<number | null>(null);
  const at = exactAt ?? openedAt;
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
  const [typed, setTyped] = useState(() => String(form.grams));

  const update = (changes: Partial<WeightForm>) => {
    setForm((current) => ({ ...current, ...changes }));
    if (changes.grams !== undefined) setTyped(String(changes.grams));
  };

  return {
    form,
    at,
    setAt: setExactAt,
    /** What is in the box, which is not a number until it reads as one. */
    typed,
    type: (text: string) => {
      setTyped(text);
      const grams = parseGrams(text);
      if (grams !== null) setForm((current) => ({ ...current, grams }));
    },
    /** False while the box holds something that is not a weight. */
    canSave: parseGrams(typed) !== null,
    update,
    save: () => {
      // Belt and braces: the Save button is already disabled while the box
      // does not read as a weight, so this cannot be reached from the sheet.
      if (parseGrams(typed) === null) return;
      saves.insert('undo.weightSaved', {
        type: 'weight',
        occurredAt: at,
        payload: { grams: form.grams, source: form.source },
      });
    },
  };
}
