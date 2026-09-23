import { useState } from 'react';

import { useEvents, useEventsRepository } from '@/db/react';
import { useUndoableSaves } from '@/db/undo';
import type { StockPlace } from '@/domain/activities';
import type { StockAdjustPayload } from '@/domain/activities/stockAdjust';
import { selectStock } from '@/domain/stock/stockState';

export type StockForm = {
  place: StockPlace;
  /** Adding milk or taking it out; the event stores one signed number. */
  direction: 'add' | 'remove';
  ml: number;
  reason: StockAdjustPayload['reason'];
};

export const ADJUST_ML = { step: 10, min: 10, max: 1000 } as const;

const DEFAULTS = { direction: 'remove', ml: 50, reason: 'correction' } as const;

/**
 * The adjust sheet (SDD 6.3): the way a count that drifted gets put right,
 * and the way milk thrown away or moved is recorded. The reason is part of
 * the entry, so the history says why the number changed.
 */
export function useStockSheet(place: StockPlace) {
  const repository = useEventsRepository();
  const saves = useUndoableSaves(repository);
  const events = useEvents();
  const [openedAt] = useState(Date.now);
  const [form, setForm] = useState<StockForm>({ place, ...DEFAULTS });

  return {
    form,
    /** What the chosen store holds now, so the change is made against a number. */
    have: selectStock(events)[form.place].ml,
    update: (changes: Partial<StockForm>) => setForm((current) => ({ ...current, ...changes })),
    save: () =>
      saves.insert('undo.stockSaved', {
        type: 'stock_adjust',
        occurredAt: openedAt,
        payload: {
          loc: form.place,
          delta_ml: form.direction === 'remove' ? -form.ml : form.ml,
          reason: form.reason,
        },
      }),
  };
}
