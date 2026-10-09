import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet } from 'react-native';

import type { WeightPayload } from '@/domain/activities/weight';
import { formatDateTime } from '@/domain/time/formatDateTime';
import { dateLocale } from '@/i18n';
import { Button, DateTimeField, Segmented, Stepper, TextField } from '@/ui/primitives';
import { deviceTimeZone } from '@/ui/deviceTimeZone';
import { useTheme, type Theme } from '@/ui/theme';

import { useWeightSheet, WEIGHT_G } from './useWeightSheet';

/** Record a weighing: the grams, and whose scale it was. */
export function WeightSheet({
  birthWeightG,
  onDone,
}: {
  birthWeightG: number | null;
  onDone: () => void;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  const s = styles(theme);
  const { form, update, save, at, setAt, typed, type, canSave } = useWeightSheet(birthWeightG);
  const tz = deviceTimeZone();
  const { i18n } = useTranslation();

  const sources: { value: WeightPayload['source']; label: string }[] = [
    { value: 'home', label: t('log.weight.source.home') },
    { value: 'clinic', label: t('log.weight.source.clinic') },
  ];

  return (
    <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
      {/* Typed first: the number is read off a scale, not arrived at.
          The stepper below nudges it (P3-F11). */}
      <TextField
        label={t('log.weight.amount')}
        value={typed}
        onChangeText={type}
        keyboardType="number-pad"
        maxLength={6}
        invalid={!canSave}
        message={t('log.weight.outOfRange', { min: WEIGHT_G.min, max: WEIGHT_G.max })}
      />
      <Stepper
        value={form.grams}
        onChange={(grams) => update({ grams })}
        step={WEIGHT_G.step}
        min={WEIGHT_G.min}
        max={WEIGHT_G.max}
        unit={t('log.weight.unit')}
        accessibilityLabel={t('log.weight.fine')}
      />
      <DateTimeField
        label={t('log.weight.when')}
        value={at}
        onChange={setAt}
        display={formatDateTime(at, tz, dateLocale(i18n.language))}
        openLabel={t('log.exactTime')}
        maximumDate={new Date()}
        testID="weight-when"
      />
      <Segmented
        options={sources}
        value={form.source}
        onChange={(source) => update({ source })}
        accessibilityLabel={t('log.weight.source.label')}
      />
      <Button
        label={t('log.save')}
        disabled={!canSave}
        onPress={() => {
          save();
          onDone();
        }}
      />
    </ScrollView>
  );
}

const styles = (theme: Theme) =>
  StyleSheet.create({
    // By analogy with the 03 weight field and the 08 stepper.
    content: { padding: theme.spacing.screen, gap: theme.spacing.lg },
  });
