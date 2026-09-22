import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { useEventsRepository } from '@/db/react';
import {
  HEALTH_NOTE_MAX,
  HEALTH_TAGS,
  parseTemperature,
  TEMP_C,
  type HealthPayload,
} from '@/domain/activities/health';
import { formatClock } from '@/domain/time/formatClock';
import { deviceTimeZone } from '@/ui/deviceTimeZone';
import { Button, Chip, TextField } from '@/ui/primitives';
import { useTheme, type Theme } from '@/ui/theme';

type Tag = (typeof HEALTH_TAGS)[number];

/**
 * A health note: required text, optional temperature in °C and tags. Invalid
 * input is shown after Save is pressed and nothing is written until it's fixed.
 * Messages describe the input, never the baby's health (rule 10).
 */
export function HealthSheet({ onDone }: { onDone: () => void }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const s = styles(theme);
  const repository = useEventsRepository();
  const [openedAt] = useState(Date.now);
  const [note, setNote] = useState('');
  const [temperature, setTemperature] = useState('');
  const [tags, setTags] = useState<Tag[]>([]);
  const [attempted, setAttempted] = useState(false);

  const temp = parseTemperature(temperature);
  const noteMissing = note.trim() === '';
  const tempInvalid = temp.kind === 'not_a_number' || temp.kind === 'out_of_range';
  const tempMessage =
    temp.kind === 'out_of_range'
      ? t('log.health.tempRange', { min: TEMP_C.min.toFixed(1), max: TEMP_C.max.toFixed(1) })
      : t('log.health.tempFormat');

  function save() {
    setAttempted(true);
    if (noteMissing || tempInvalid) return;
    const payload: HealthPayload = {
      note: note.trim(),
      ...(temp.kind === 'value' && { temp_c: temp.celsius }),
      ...(tags.length > 0 && { tags }),
    };
    repository.insert({ type: 'health', occurredAt: openedAt, payload });
    onDone();
  }

  const toggle = (tag: Tag) =>
    setTags((current) =>
      current.includes(tag) ? current.filter((x) => x !== tag) : [...current, tag],
    );

  return (
    <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
      <Text style={s.muted}>
        {t('log.time', { time: formatClock(openedAt, deviceTimeZone()) })}
      </Text>
      <TextField
        label={t('log.health.note')}
        value={note}
        onChangeText={setNote}
        maxLength={HEALTH_NOTE_MAX}
        multiline
        hint={t('log.characters', { count: note.length, max: HEALTH_NOTE_MAX })}
        invalid={attempted && noteMissing}
        message={t('log.health.noteMissing')}
      />
      <TextField
        label={t('log.health.temperature')}
        value={temperature}
        onChangeText={setTemperature}
        keyboardType="decimal-pad"
        invalid={attempted && tempInvalid}
        message={tempMessage}
      />
      <Text style={theme.text.label}>{t('log.health.tags')}</Text>
      <View style={s.tags}>
        {HEALTH_TAGS.map((tag) => (
          <Chip
            key={tag}
            label={t(`log.health.tag.${tag}`)}
            selected={tags.includes(tag)}
            onPress={() => toggle(tag)}
          />
        ))}
      </View>
      <Button label={t('log.save')} onPress={save} />
    </ScrollView>
  );
}

const styles = (theme: Theme) =>
  StyleSheet.create({
    content: { padding: theme.spacing.lg, gap: theme.spacing.lg },
    muted: { ...theme.text.label, color: theme.colors.textMuted },
    tags: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm },
  });
