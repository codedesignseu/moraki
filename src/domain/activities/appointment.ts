import { z } from 'zod';

import { formatClock } from '../time/formatClock';

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

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;

/** How long before an appointment each reminder lands (P3-12). */
export const APPOINTMENT_REMINDERS = [
  { id: 'day', before: DAY_MS, bodyKey: 'reminders.appointment.dayBefore' },
  { id: 'hour', before: HOUR_MS, bodyKey: 'reminders.appointment.hourBefore' },
] as const;

export const appointmentModule: ActivityModule<AppointmentPayload> = {
  type: 'appointment',
  schema: appointmentSchema,
  i18nKey: 'activity.appointment.label',
  icon: 'visit',
  tone: 'diaper',
  historyGroup: 'other',
  summarize: (e) => ({ key: 'activity.appointment.summary', values: { title: e.payload.title } }),
  /**
   * A day before and an hour before (P3-12). Only what is still ahead: a
   * reminder for a moment that has passed would fire the instant it was set.
   * The body says only that there is an appointment and, the day before, at
   * what time. The title is free text someone typed (a clinic, a reason for
   * the visit), so it never reaches a lock screen (rule 8).
   */
  reminders: (events, _settings, now, tz) =>
    events
      .filter((e) => e.deletedAt === null)
      .flatMap((e) =>
        APPOINTMENT_REMINDERS.map((reminder) => ({
          id: `appointment:${e.id}:${reminder.id}`,
          category: 'appointment' as const,
          at: e.occurredAt - reminder.before,
          bodyKey: reminder.bodyKey,
          ...(reminder.id === 'day' ? { values: { time: formatClock(e.occurredAt, tz) } } : {}),
        })),
      )
      .filter((reminder) => reminder.at > now),
};
