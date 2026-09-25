import type { Event } from './contract';
import type { AppointmentPayload } from './appointment';
import { isAppointment } from './queries';

export type AppointmentForm = {
  title: string;
  doctor: string;
  clinic: string;
  notes: string;
  /** What to ask at the visit; they reach the call script (P3-13). */
  questions: string[];
};

export const APPOINTMENT_LIMITS = {
  title: 100,
  doctor: 60,
  clinic: 80,
  notes: 500,
  question: 200,
  questions: 20,
} as const;

export const EMPTY_APPOINTMENT: AppointmentForm = {
  title: '',
  doctor: '',
  clinic: '',
  notes: '',
  questions: [],
};

/** Reads a saved appointment back into the sheet's form. */
export function appointmentForm(event: Event<unknown> | null): AppointmentForm | null {
  if (!event || event.deletedAt !== null || !isAppointment(event)) return null;
  return {
    title: event.payload.title,
    doctor: event.payload.doctor ?? '',
    clinic: event.payload.clinic ?? '',
    notes: event.payload.notes ?? '',
    questions: event.payload.questions ?? [],
  };
}

/** The form as a payload: what was left blank is left out, not stored empty. */
export function appointmentPayload(form: AppointmentForm): AppointmentPayload {
  const questions = form.questions.map((q) => q.trim()).filter((q) => q !== '');
  return {
    title: form.title.trim(),
    ...(form.doctor.trim() !== '' && { doctor: form.doctor.trim() }),
    ...(form.clinic.trim() !== '' && { clinic: form.clinic.trim() }),
    ...(form.notes.trim() !== '' && { notes: form.notes.trim() }),
    ...(questions.length > 0 && { questions }),
  };
}

/**
 * The next appointment still to come (SDD 7's home card), or null. Soonest
 * first; one that has already happened is history, not something to show at
 * the top of a screen.
 */
export function nextAppointment(
  events: readonly Event<unknown>[],
  now: number,
): Event<AppointmentPayload> | null {
  return events
    .filter((e) => e.deletedAt === null)
    .filter(isAppointment)
    .filter((e) => e.occurredAt > now)
    .reduce<Event<AppointmentPayload> | null>(
      (soonest, e) => (soonest === null || e.occurredAt < soonest.occurredAt ? e : soonest),
      null,
    );
}
