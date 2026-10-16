import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';

import { PUMP_ML, type PumpPrefill } from '@/domain/activities';
import { Button, ChoiceButtons, DateTimeField, FieldLabel, Stepper } from '@/ui/primitives';
import type { ChoiceOption } from '@/ui/primitives';
import { useTheme, type Theme } from '@/ui/theme';

import { usePumpSheet } from './usePumpSheet';

/** Log a pumping session: how much, and where it went. */
export function PumpSheet({ onDone }: { onDone: () => void }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const s = styles(theme);
  const { form, at, atLabel, setAt, update, save } = usePumpSheet();

  // G sheets/pump: the fridge in the pump colour, the freezer in diaper blue,
  // fed in the feed colour.
  const dests: ChoiceOption<PumpPrefill['dest']>[] = [
    { value: 'fridge', label: t('log.pump.dest.fridge'), tone: 'pump' },
    { value: 'freezer', label: t('log.pump.dest.freezer'), tone: 'diaper' },
    { value: 'fed', label: t('log.pump.dest.fed'), tone: 'feed' },
  ];

  return (
    <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
      <DateTimeField
        label={t('log.pump.when')}
        value={at}
        onChange={setAt}
        display={atLabel}
        openLabel={t('log.exactTime')}
        maximumDate={new Date()}
        testID="pump-when"
      />
      <View style={s.field}>
        <FieldLabel label={t('log.pump.amount')} />
        <Stepper
          value={form.ml}
          onChange={(ml) => update({ ml })}
          step={PUMP_ML.step}
          min={PUMP_ML.min}
          max={PUMP_ML.max}
          unit={t('log.pump.unit')}
          accessibilityLabel={t('log.pump.amount')}
        />
      </View>
      <View style={s.field}>
        <FieldLabel label={t('log.pump.dest.label')} />
        <ChoiceButtons
          options={dests}
          value={form.dest}
          onChange={(dest) => update({ dest })}
          accessibilityLabel={t('log.pump.dest.label')}
        />
      </View>
      <View style={s.footer}>
        <Button
          label={t('log.save')}
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
    // G sheets/pump: the feed sheet's spacing.
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
