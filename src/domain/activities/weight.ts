import { z } from 'zod';

import type { ActivityModule } from './contract';

export const weightSchema = z.object({
  grams: z.int().min(500).max(15000),
  source: z.enum(['home', 'clinic']),
});

export type WeightPayload = z.infer<typeof weightSchema>;

export const weightModule: ActivityModule<WeightPayload> = {
  type: 'weight',
  schema: weightSchema,
  i18nKey: 'activity.weight.label',
};
