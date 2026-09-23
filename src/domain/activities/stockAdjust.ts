import { z } from 'zod';

import { addMilk, takeMilk, type ActivityModule } from './contract';

export const stockAdjustSchema = z.object({
  loc: z.enum(['fridge', 'freezer']),
  // Signed: negative removes milk from the location, positive adds it.
  delta_ml: z.int(),
  reason: z.enum(['discard', 'move', 'correction']),
});

export type StockAdjustPayload = z.infer<typeof stockAdjustSchema>;

export const stockAdjustModule: ActivityModule<StockAdjustPayload> = {
  type: 'stock_adjust',
  schema: stockAdjustSchema,
  i18nKey: 'activity.stock_adjust.label',
  historyGroup: 'other',
  contributes: {
    stock: (acc, e) =>
      e.payload.delta_ml >= 0
        ? addMilk(acc, e.payload.loc, e.occurredAt, e.payload.delta_ml)
        : takeMilk(acc, e.payload.loc, e.occurredAt, -e.payload.delta_ml),
  },
};
