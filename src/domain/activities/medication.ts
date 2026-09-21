import { z } from 'zod';

import type { ActivityModule } from './contract';

export const medicationSchema = z.object({
  // SDD 4.1 caps it at 60; a medication with no name is never valid.
  name: z.string().min(1).max(60),
  dose: z.string().max(30).optional(),
});

export type MedicationPayload = z.infer<typeof medicationSchema>;

export const medicationModule: ActivityModule<MedicationPayload> = {
  type: 'medication',
  schema: medicationSchema,
  i18nKey: 'activity.medication.label',
};
