import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text } from 'react-native';

import type { StockPlace } from '@/domain/activities';
import type { StockAdjustPayload } from '@/domain/activities/stockAdjust';
import { Button, Segmented, Stepper } from '@/ui/primitives';
import { useTheme, type Theme } from '@/ui/theme';

import { ADJUST_ML, useStockSheet, type StockForm } from './useStockSheet';

/** Put a store's count right, or record milk thrown away or moved. */
export function StockSheet({ place, onDone }: { place: StockPlace; onDone: () => void }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const s = styles(theme);
  const { form, have, update, save } = useStockSheet(place);

  const places: { value: StockPlace; label: string }[] = [
    { value: 'fridge', label: t('log.stock.place.fridge') },
    { value: 'freezer', label: t('log.stock.place.freezer') },
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

  return (
    <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
      <Segmented
        options={places}
        value={form.place}
        onChange={(chosen) => update({ place: chosen })}
        accessibilityLabel={t('log.stock.place.label')}
      />
      <Text style={s.muted}>
        {t('log.stock.have', { place: t(`log.stock.place.${form.place}`), ml: have })}
      </Text>
      <Segmented
        options={directions}
        value={form.direction}
        onChange={(direction) => update({ direction })}
        accessibilityLabel={t('log.stock.direction.label')}
      />
      <Stepper
        value={form.ml}
        onChange={(ml) => update({ ml })}
        step={ADJUST_ML.step}
        min={ADJUST_ML.min}
        max={ADJUST_ML.max}
        unit={t('log.stock.unit')}
        accessibilityLabel={t('log.stock.amount')}
      />
      <Segmented
        options={reasons}
        value={form.reason}
        onChange={(reason) => update({ reason })}
        accessibilityLabel={t('log.stock.reason.label')}
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
