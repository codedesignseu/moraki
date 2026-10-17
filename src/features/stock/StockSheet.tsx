import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import type { StockPlace } from '@/domain/activities';
import type { StockAdjustPayload } from '@/domain/activities/stockAdjust';
import { Button, ChoiceButtons, Chip, FieldLabel, Segmented, Stepper } from '@/ui/primitives';
import type { ChoiceOption } from '@/ui/primitives';
import { useTheme, type Theme } from '@/ui/theme';

import { ADJUST_ML, useStockSheet, type StockForm } from './useStockSheet';

/** Put a store's count right, or record milk thrown away or moved. */
export function StockSheet({ place, onDone }: { place: StockPlace; onDone: () => void }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const s = styles(theme);
  const { form, have, update, save } = useStockSheet(place);

  // G sheets/milk-stock: the fridge in the pump colour, the freezer in diaper blue.
  const places: ChoiceOption<StockPlace>[] = [
    { value: 'fridge', label: t('log.stock.place.fridge'), tone: 'pump' },
    { value: 'freezer', label: t('log.stock.place.freezer'), tone: 'diaper' },
  ];
  const directions: { value: StockForm['direction']; label: string }[] = [
    { value: 'add', label: t('log.stock.direction.add') },
    { value: 'remove', label: t('log.stock.direction.remove') },
  ];
  const reasons: { value: StockAdjustPayload['reason']; label: string }[] = [
    { value: 'discard', label: t('log.stock.reason.discard') },
    { value: 'move', label: t('log.stock.reason.move') },
    { value: 'correction', label: t('log.stock.reason.correction') },
  ];
  const nowIn = t(`log.stock.nowIn.${form.place}`);
  const amount = t('log.stock.ml', { ml: have });

  return (
    <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
      <View style={s.field}>
        <FieldLabel label={t('log.stock.place.label')} />
        <ChoiceButtons
          options={places}
          value={form.place}
          onChange={(chosen) => update({ place: chosen })}
          accessibilityLabel={t('log.stock.place.label')}
        />
      </View>
      {/* What the store holds now, so the change is made against a number. */}
      <View
        style={s.haveRow}
        accessible
        accessibilityLabel={t('log.stock.have', { place: nowIn, ml: amount })}
        testID="stock-have"
      >
        <Text style={[theme.type.detail, s.soft]}>{nowIn}</Text>
        <Text style={[theme.type.figureRow, s.value]}>{amount}</Text>
      </View>
      <Segmented
        options={directions}
        value={form.direction}
        onChange={(direction) => update({ direction })}
        accessibilityLabel={t('log.stock.direction.label')}
      />
      <View style={s.field}>
        <FieldLabel label={t('log.stock.amount')} />
        <Stepper
          value={form.ml}
          onChange={(ml) => update({ ml })}
          step={ADJUST_ML.step}
          min={ADJUST_ML.min}
          max={ADJUST_ML.max}
          unit={t('log.stock.unit')}
          accessibilityLabel={t('log.stock.amount')}
        />
      </View>
      <View style={s.field}>
        <FieldLabel label={t('log.stock.reason.label')} />
        {/* One reason, always: tapping the chosen chip keeps it. */}
        <View style={s.chips} accessibilityLabel={t('log.stock.reason.label')}>
          {reasons.map((reason) => (
            <Chip
              key={reason.value}
              label={reason.label}
              selected={form.reason === reason.value}
              onPress={() => update({ reason: reason.value })}
            />
          ))}
        </View>
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
    // G sheets/milk-stock: the feed sheet's spacing.
    content: {
      flexGrow: 1,
      paddingHorizontal: theme.spacing.screen,
      paddingTop: theme.spacing.section,
      paddingBottom: theme.spacing.xl,
      gap: theme.spacing.section,
    },
    field: { gap: theme.spacing.sm },
    // "Now in the fridge … 240 ml" over a hairline, as Settings' value rows.
    haveRow: {
      minHeight: theme.size.valueRow,
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      justifyContent: 'space-between',
      columnGap: theme.spacing.md,
      borderBottomWidth: theme.size.borderThin,
      borderBottomColor: theme.palette.line,
    },
    soft: { color: theme.palette.textSoft },
    value: { flexShrink: 1, textAlign: 'right', color: theme.palette.ink },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm },
    footer: { marginTop: 'auto' },
  });
