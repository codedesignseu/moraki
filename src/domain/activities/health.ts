import { z } from 'zod';

import type { ActivityModule } from './contract';

/** Observations only, no severity. Recorded, never interpreted (rule 10). */
export const HEALTH_TAGS = [
  'rash',
  'vomiting',
  'cough',
  'congestion',
  'fussy',
  'jaundice',
  'other',
] as const;

export const healthSchema = z.object({
  note: z.string().min(1).max(500),
  temp_c: z.number().min(34).max(43).optional(),
  tags: z.array(z.enum(HEALTH_TAGS)).optional(),
});

export type HealthPayload = z.infer<typeof healthSchema>;

export const healthModule: ActivityModule<HealthPayload> = {
  type: 'health',
  schema: healthSchema,
  i18nKey: 'activity.health.label',
};
