import { z } from 'zod';

import type { ActivityModule } from './contract';

export const appointmentSchema = z.object({
  title: z.string().min(1).max(100),
  doctor: z.string().max(60).optional(),
  clinic: z.string().max(80).optional(),
  notes: z.string().max(500).optional(),
  // Questions to ask at the visit; they feed the call script (P3-13).
  questions: z.array(z.string().min(1).max(200)).max(20).optional(),
});

export type AppointmentPayload = z.infer<typeof appointmentSchema>;

export const appointmentModule: ActivityModule<AppointmentPayload> = {
  type: 'appointment',
  schema: appointmentSchema,
  i18nKey: 'activity.appointment.label',
  historyGroup: 'other',
};
