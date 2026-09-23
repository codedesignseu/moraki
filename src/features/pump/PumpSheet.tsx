import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text } from 'react-native';

import { PUMP_ML, type PumpPrefill } from '@/domain/activities';
import { Button, Segmented, Stepper } from '@/ui/primitives';
import { useTheme, type Theme } from '@/ui/theme';

import { usePumpSheet } from './usePumpSheet';

/** Log a pumping session: how much, and where it went. */
export function PumpSheet({ onDone }: { onDone: () => void }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const s = styles(theme);
  const { form, at, update, save } = usePumpSheet();

  const dests: { value: PumpPrefill['dest']; label: string }[] = [
    { value: 'fridge', label: t('log.pump.dest.fridge') },
    { value: 'freezer', label: t('log.pump.dest.freezer') },
    { value: 'fed', label: t('log.pump.dest.fed') },
  ];

  return (
    <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
      <Text style={s.muted}>{t('log.time', { time: at })}</Text>
      <Stepper
        value={form.ml}
        onChange={(ml) => update({ ml })}
        step={PUMP_ML.step}
        min={PUMP_ML.min}
        max={PUMP_ML.max}
        unit={t('log.pump.unit')}
        accessibilityLabel={t('log.pump.amount')}
      />
      <Segmented
        options={dests}
        value={form.dest}
        onChange={(dest) => update({ dest })}
        accessibilityLabel={t('log.pump.dest.label')}
      />
      <Button
        label={t('log.save')}
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
    content: { padding: theme.spacing.lg, gap: theme.spacing.lg },
    muted: { ...theme.text.label, color: theme.colors.textMuted },
  });
