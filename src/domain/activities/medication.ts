import { z } from 'zod';

import type { ActivityModule } from './contract';

/** SDD 4.1 limits, shared by the schema and the sheet. */
export const MEDICATION_NAME_MAX = 60;
export const MEDICATION_DOSE_MAX = 30;

export const medicationSchema = z.object({
  // SDD 4.1 caps it at 60; a medication with no name is never valid.
  name: z.string().min(1).max(MEDICATION_NAME_MAX),
  dose: z.string().max(MEDICATION_DOSE_MAX).optional(),
});

export type MedicationPayload = z.infer<typeof medicationSchema>;

export const medicationModule: ActivityModule<MedicationPayload> = {
  type: 'medication',
  schema: medicationSchema,
  i18nKey: 'activity.medication.label',
  historyGroup: 'health',
  summarize: (e) =>
    e.payload.dose
      ? {
          key: 'activity.medication.summary.withDose',
          values: { name: e.payload.name, dose: e.payload.dose },
        }
      : { key: 'activity.medication.summary.nameOnly', values: { name: e.payload.name } },
};
