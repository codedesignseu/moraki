import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useEventsRepository } from '@/db/react';
import { useUndoableSaves } from '@/db/undo';
import {
  appointmentForm,
  appointmentPayload,
  APPOINTMENT_LIMITS,
  DAYS_AHEAD,
  EMPTY_APPOINTMENT,
  type AppointmentForm,
} from '@/domain/activities';
import { formatDateTime } from '@/domain/time/formatDateTime';
import { startOfLocalDay } from '@/domain/time/zoned';
import { dateLocale } from '@/i18n';
import { deviceTimeZone } from '@/ui/deviceTimeZone';

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

/** The time of day a new appointment starts at, before anyone changes it. */
const DEFAULT_HOUR = 10;

export type AppointmentTime = { days: number; hour: number; minute: number };

/**
 * The appointment sheet (SDD 4.1, P3-12). A clinic visit is a time someone
 * was told, so it is set rather than prefilled from the clock: days ahead,
 * then the hour and minute. The day is a local day, so an appointment stays
 * on its date across a DST change.
 */
export function useAppointmentSheet(entryId?: string) {
  const repository = useEventsRepository();
  const saves = useUndoableSaves(repository);
  const { i18n } = useTranslation();
  const tz = deviceTimeZone();
  const [openedAt] = useState(Date.now);
  const [saved] = useState(() => (entryId ? repository.get(entryId) : null));
  const [form, setForm] = useState<AppointmentForm>(
    () => appointmentForm(saved) ?? EMPTY_APPOINTMENT,
  );
  const [time, setTime] = useState<AppointmentTime>(() => {
    if (!saved) return { days: 1, hour: DEFAULT_HOUR, minute: 0 };
    const midnight = startOfLocalDay(saved.occurredAt, tz);
    const intoDay = saved.occurredAt - midnight;
    return {
      days: Math.round((midnight - startOfLocalDay(openedAt, tz)) / DAY_MS),
      hour: Math.floor(intoDay / HOUR_MS),
      minute: Math.round((intoDay % HOUR_MS) / MINUTE_MS),
    };
  });
  const [draft, setDraft] = useState('');

  // The steppers say "in N days at HH:MM"; the picker sets the moment
  // outright. Whichever was touched last is the answer: the picker's choice
  // stands until a stepper moves, which clears it.
  const [exact, setExact] = useState<number | null>(null);
  const fromSteppers =
    startOfLocalDay(openedAt, tz) +
    time.days * DAY_MS +
    time.hour * HOUR_MS +
    time.minute * MINUTE_MS;
  const at = exact ?? fromSteppers;

  return {
    form,
    time,
    at,
    editing: saved !== null && appointmentForm(saved) !== null,
    /** The moment in words, so nobody has to add the steppers up in their head. */
    when: formatDateTime(at, tz, dateLocale(i18n.language)),
    /** Empty until there is a title: everything else about a visit is optional. */
    canSave: form.title.trim() !== '',
    draft,
    setDraft,
    setTime: (changes: Partial<AppointmentTime>) => {
      setExact(null);
      setTime((current) => ({ ...current, ...changes }));
    },
    /** The picker's answer, which stands until a stepper moves again. */
    setAt: setExact,
    update: (changes: Partial<AppointmentForm>) =>
      setForm((current) => ({ ...current, ...changes })),
    addQuestion: () => {
      const question = draft.trim().slice(0, APPOINTMENT_LIMITS.question);
      if (question === '' || form.questions.length >= APPOINTMENT_LIMITS.questions) return;
      setForm((current) => ({ ...current, questions: [...current.questions, question] }));
      setDraft('');
    },
    removeQuestion: (index: number) =>
      setForm((current) => ({
        ...current,
        questions: current.questions.filter((_, i) => i !== index),
      })),
    save: () => {
      if (form.title.trim() === '') return;
      const payload = appointmentPayload(form);
      if (saved) {
        saves.patch('undo.appointmentSaved', [
          { id: saved.id, changes: { payload, occurredAt: at } },
        ]);
        return;
      }
      saves.insert('undo.appointmentSaved', { type: 'appointment', occurredAt: at, payload });
    },
    limits: APPOINTMENT_LIMITS,
    daysAhead: DAYS_AHEAD,
  };
}
