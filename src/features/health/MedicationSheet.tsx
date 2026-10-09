import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text } from 'react-native';

import { useEvents, useEventsRepository } from '@/db/react';
import { useUndoableSaves } from '@/db/undo';
import { lastMedication } from '@/domain/activities';
import {
  MEDICATION_DOSE_MAX,
  MEDICATION_NAME_MAX,
  type MedicationPayload,
} from '@/domain/activities/medication';
import { formatClock } from '@/domain/time/formatClock';
import { formatDateTime } from '@/domain/time/formatDateTime';
import { dateLocale } from '@/i18n';
import { deviceTimeZone } from '@/ui/deviceTimeZone';
import { Button, StatusPill, TextField, TimeShiftField } from '@/ui/primitives';
import { useTheme, type Theme } from '@/ui/theme';

/**
 * A medication given now. Opens with the last medication's *name* (SDD 7
 * last-used prefill), so a daily vitamin is one tap away — but never its
 * amount: an infant's dose moves with weight and age, so carrying yesterday's
 * number forward invites saving it on autopilot. The one place friction earns
 * its keep (P3-F12).
 */
const MINUTE_MS = 60_000;

export function MedicationSheet({ onDone, entryId }: { onDone: () => void; entryId?: string }) {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const s = styles(theme);
  const repository = useEventsRepository();
  const saves = useUndoableSaves(repository);
  const events = useEvents();
  const [openedAt] = useState(Date.now);
  // Editing (P1-12) opens on the entry itself; logging, on the last medication.
  const [entry] = useState(() => (entryId ? repository.get(entryId) : null));
  const [last] = useState(() =>
    entry ? (entry.payload as MedicationPayload) : lastMedication(events),
  );
  const [shift, setShift] = useState(0);
  const tz = deviceTimeZone();
  const [name, setName] = useState(last?.name ?? '');
  // Editing shows what was saved; logging starts the amount empty.
  const [dose, setDose] = useState(entry ? (last?.dose ?? '') : '');
  const [attempted, setAttempted] = useState(false);
  const nameMissing = name.trim() === '';

  function save() {
    setAttempted(true);
    if (nameMissing) return;
    const payload: MedicationPayload = {
      name: name.trim(),
      ...(dose.trim() !== '' && { dose: dose.trim() }),
    };
    if (entry) {
      saves.patch('undo.entryUpdated', [
        {
          id: entry.id,
          changes: {
            payload,
            ...(payload.dose === undefined && { unset: ['dose'] }),
            ...(shift !== 0 && { occurredAt: entry.occurredAt + shift * MINUTE_MS }),
          },
        },
      ]);
    } else {
      saves.insert('undo.medicationSaved', { type: 'medication', occurredAt: openedAt, payload });
    }
    onDone();
  }

  return (
    // A text field at the bottom of a scroll is what the keyboard covers.
    // KeyboardAvoidingView's padding is short by the navigation header's
    // height, and this project has no useHeaderHeight to feed it, so the
    // scroll view does the work instead: iOS insets itself for the keyboard,
    // Android resizes the window, and either way the caret stays in sight.
    <ScrollView
      testID="medication-sheet"
      contentContainerStyle={s.content}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
      automaticallyAdjustKeyboardInsets
    >
      {entry ? (
        <TimeShiftField
          label={t('entry.moveTime')}
          minutes={shift}
          onChange={setShift}
          unit={t('entry.minutes')}
          result={t('entry.newTime', {
            time: formatDateTime(
              entry.occurredAt + shift * MINUTE_MS,
              tz,
              dateLocale(i18n.language),
            ),
          })}
        />
      ) : (
        <>
          <Text style={theme.type.heading}>{t('log.medication.adding')}</Text>
          <StatusPill label={t('log.time', { time: formatClock(openedAt, tz) })} />
          {last !== null && <Text style={s.muted}>{t('log.medication.prefilled')}</Text>}
        </>
      )}
      <TextField
        label={t('log.medication.name')}
        value={name}
        onChangeText={setName}
        maxLength={MEDICATION_NAME_MAX}
        hint={t('log.characters', { count: name.length, max: MEDICATION_NAME_MAX })}
        invalid={attempted && nameMissing}
        message={t('log.medication.nameMissing')}
      />
      <TextField
        label={t('log.medication.dose')}
        value={dose}
        onChangeText={setDose}
        maxLength={MEDICATION_DOSE_MAX}
        hint={t('log.characters', { count: dose.length, max: MEDICATION_DOSE_MAX })}
      />
      <Button label={t('log.save')} onPress={save} />
    </ScrollView>
  );
}

const styles = (theme: Theme) =>
  StyleSheet.create({
    content: {
      padding: theme.spacing.screen,
      paddingBottom: theme.spacing.xl,
      gap: theme.spacing.lg,
    },
    muted: { ...theme.type.detail, color: theme.palette.textSoft },
  });
