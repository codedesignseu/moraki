import { z } from 'zod';

import { addMilk, type ActivityModule } from './contract';

export const pumpSchema = z.object({
  ml: z.int().min(1).max(600),
  dest: z.enum(['fridge', 'freezer', 'fed']),
});

export type PumpPayload = z.infer<typeof pumpSchema>;

export const pumpModule: ActivityModule<PumpPayload> = {
  type: 'pump',
  schema: pumpSchema,
  i18nKey: 'activity.pump.label',
  historyGroup: 'other',
  contributes: {
    // Milk pumped and put away is a batch, dated when it was pumped, so its
    // age is the age of the milk (SDD 6.3). `fed` never reaches a store.
    stock: (acc, e) =>
      e.payload.dest === 'fed' ? acc : addMilk(acc, e.payload.dest, e.occurredAt, e.payload.ml),
  },
};
