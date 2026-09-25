import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useEventsRepository } from '@/db/react';
import { useUndoableSaves } from '@/db/undo';
import {
  appointmentForm,
  appointmentPayload,
  APPOINTMENT_LIMITS,
  EMPTY_APPOINTMENT,
  type AppointmentForm,
} from '@/domain/activities';
import { formatDateTime } from '@/domain/time/formatDateTime';
import { startOfLocalDay } from '@/domain/time/zoned';
import { dateLocale } from '@/i18n';
import { deviceTimeZone } from '@/ui/deviceTimeZone';

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;

/** Where a new appointment opens: tomorrow mid-morning, until it is moved. */
const DEFAULT_HOUR = 10;

/**
 * The appointment sheet (SDD 4.1, P3-12). A clinic visit is a time someone
 * was told, so it is set outright with the picker rather than nudged towards
 * with steppers. The opening guess is built off a local day, so it lands on
 * the same wall-clock hour across a DST change.
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
  const [draft, setDraft] = useState('');
  const [at, setAt] = useState(
    () => saved?.occurredAt ?? startOfLocalDay(openedAt, tz) + DAY_MS + DEFAULT_HOUR * HOUR_MS,
  );

  return {
    form,
    at,
    editing: saved !== null && appointmentForm(saved) !== null,
    /** The moment in words, so the saved time is read back the way it reads on a card. */
    when: formatDateTime(at, tz, dateLocale(i18n.language)),
    /** Empty until there is a title: everything else about a visit is optional. */
    canSave: form.title.trim() !== '',
    draft,
    setDraft,
    setAt,
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
  };
}
