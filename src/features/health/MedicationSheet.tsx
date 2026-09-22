import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text } from 'react-native';

import { useEvents, useEventsRepository } from '@/db/react';
import { lastMedication } from '@/domain/activities';
import {
  MEDICATION_DOSE_MAX,
  MEDICATION_NAME_MAX,
  type MedicationPayload,
} from '@/domain/activities/medication';
import { formatClock } from '@/domain/time/formatClock';
import { deviceTimeZone } from '@/ui/deviceTimeZone';
import { Button, TextField } from '@/ui/primitives';
import { useTheme, type Theme } from '@/ui/theme';

/**
 * A medication given now. Opens with the last medication's name and dose (SDD 7
 * last-used prefill), so a daily vitamin is one tap on Save.
 */
export function MedicationSheet({ onDone }: { onDone: () => void }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const s = styles(theme);
  const repository = useEventsRepository();
  const events = useEvents();
  const [openedAt] = useState(Date.now);
  const [last] = useState(() => lastMedication(events));
  const [name, setName] = useState(last?.name ?? '');
  const [dose, setDose] = useState(last?.dose ?? '');
  const [attempted, setAttempted] = useState(false);
  const nameMissing = name.trim() === '';

  function save() {
    setAttempted(true);
    if (nameMissing) return;
    const payload: MedicationPayload = {
      name: name.trim(),
      ...(dose.trim() !== '' && { dose: dose.trim() }),
    };
    repository.insert({ type: 'medication', occurredAt: openedAt, payload });
    onDone();
  }

  return (
    <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
      <Text style={s.muted}>
        {t('log.time', { time: formatClock(openedAt, deviceTimeZone()) })}
      </Text>
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
    content: { padding: theme.spacing.lg, gap: theme.spacing.lg },
    muted: { ...theme.text.label, color: theme.colors.textMuted },
  });
