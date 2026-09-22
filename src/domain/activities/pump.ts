import { z } from 'zod';

import type { ActivityModule } from './contract';

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
};
