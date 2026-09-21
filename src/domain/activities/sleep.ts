import { z } from 'zod';

import type { ActivityModule } from './contract';

export const sleepSchema = z.object({
  place: z.enum(['crib', 'bassinet', 'arms', 'stroller', 'other']).optional(),
});

export type SleepPayload = z.infer<typeof sleepSchema>;

export const sleepModule: ActivityModule<SleepPayload> = {
  type: 'sleep',
  schema: sleepSchema,
  i18nKey: 'activity.sleep.label',
};
