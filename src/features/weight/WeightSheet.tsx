import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';

import type { WeightPayload } from '@/domain/activities/weight';
import { fieldDate } from '@/domain/time/fieldTime';
import { dateLocale } from '@/i18n';
import { formatFieldDate } from '@/i18n/fieldTime';
import { deviceTimeZone } from '@/ui/deviceTimeZone';
import { Button, DateTimeField, FieldLabel, Segmented, Stepper, TextField } from '@/ui/primitives';
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
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const s = styles(theme);
  const { form, update, save, at, setAt, typed, type, canSave } = useWeightSheet(birthWeightG);
  const tz = deviceTimeZone();
  const [openedAt] = useState(Date.now);
  const locale = dateLocale(i18n.language);
  const grams = new Intl.NumberFormat(locale);

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
        suffix={t('log.weight.unit')}
        invalid={!canSave}
        message={t('log.weight.outOfRange', {
          min: grams.format(WEIGHT_G.min),
          max: grams.format(WEIGHT_G.max),
        })}
        errorPrefix={t('common.error')}
      />
      <View style={s.field}>
        <FieldLabel label={t('log.weight.fine')} />
        <Stepper
          value={form.grams}
          onChange={(value) => update({ grams: value })}
          step={WEIGHT_G.step}
          min={WEIGHT_G.min}
          max={WEIGHT_G.max}
          unit={t('log.weight.unit')}
          accessibilityLabel={t('log.weight.fine')}
          size="compact"
        />
      </View>
      <DateTimeField
        label={t('log.weight.when')}
        value={at}
        onChange={setAt}
        display={formatFieldDate(t, fieldDate(at, openedAt, tz, locale))}
        openLabel={t('log.exactTime')}
        maximumDate={new Date()}
        testID="weight-when"
      />
      <View style={s.field}>
        <FieldLabel label={t('log.weight.source.label')} />
        <Segmented
          options={sources}
          value={form.source}
          onChange={(source) => update({ source })}
          accessibilityLabel={t('log.weight.source.label')}
        />
      </View>
      <View style={s.footer}>
        <Button
          label={t('log.save')}
          disabled={!canSave}
          onPress={() => {
            save();
            onDone();
          }}
        />
      </View>
    </ScrollView>
  );
}

const styles = (theme: Theme) =>
  StyleSheet.create({
    // G sheets/weight: the feed sheet's spacing.
    content: {
      flexGrow: 1,
      paddingHorizontal: theme.spacing.screen,
      paddingTop: theme.spacing.section,
      paddingBottom: theme.spacing.xl,
      gap: theme.spacing.section,
    },
    field: { gap: theme.spacing.sm },
    footer: { marginTop: 'auto' },
  });
