import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text } from 'react-native';

import { BREAST_MINUTES, type FeedKind, type FeedPrefill } from '@/domain/activities';
import { Button, Segmented, Stepper, TimeShiftField } from '@/ui/primitives';
import { useTheme, type Theme } from '@/ui/theme';

import { useFeedSheet } from './useFeedSheet';

const ML_STEP = 10;
const ML_MIN = 10;
const ML_MAX = 400;

/** Log a bottle, breast or mixed feed. Opens prefilled; Save is the only required tap. */
export function FeedSheet({ onDone, entryId }: { onDone: () => void; entryId?: string }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const s = styles(theme);
  const { form, when, update, save, editing, shift, setShift, newStart } = useFeedSheet(entryId);

  const kinds: { value: FeedKind; label: string }[] = [
    { value: 'bottle', label: t('log.feed.kind.bottle') },
    { value: 'breast', label: t('log.feed.kind.breast') },
    { value: 'mixed', label: t('log.feed.kind.mixed') },
  ];
  const milks: { value: FeedPrefill['milk']; label: string }[] = [
    { value: 'breast', label: t('log.feed.milk.breast') },
    { value: 'formula', label: t('log.feed.milk.formula') },
    { value: 'mixed', label: t('log.feed.milk.mixed') },
  ];
  const sides: { value: FeedPrefill['side']; label: string }[] = [
    { value: 'left', label: t('log.feed.side.left') },
    { value: 'right', label: t('log.feed.side.right') },
    { value: 'both', label: t('log.feed.side.both') },
  ];
  const hasBottle = form.kind !== 'breast';
  const hasBreast = form.kind !== 'bottle';

  return (
    <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
      {editing ? (
        <TimeShiftField
          label={t('entry.moveTime')}
          minutes={shift}
          onChange={setShift}
          unit={t('entry.minutes')}
          result={t('entry.newTime', { time: newStart })}
        />
      ) : (
        <Text style={s.muted}>
          {'at' in when ? t('log.time', { time: when.at }) : t('log.feed.range', when)}
        </Text>
      )}
      <Segmented
        options={kinds}
        value={form.kind}
        onChange={(kind) => update({ kind })}
        accessibilityLabel={t('log.feed.kind.label')}
        // A logged feed keeps its kind; to change it, delete and log again.
        disabled={editing}
      />
      {hasBottle && (
        <>
          <Stepper
            value={form.ml}
            onChange={(ml) => update({ ml })}
            step={ML_STEP}
            min={ML_MIN}
            max={ML_MAX}
            unit={t('log.feed.unit')}
            accessibilityLabel={t('log.feed.amount')}
          />
          <Segmented
            options={milks}
            value={form.milk}
            onChange={(milk) => update({ milk })}
            accessibilityLabel={t('log.feed.milk.label')}
          />
        </>
      )}
      {hasBreast && (
        <>
          <Segmented
            options={sides}
            value={form.side}
            onChange={(side) => update({ side })}
            accessibilityLabel={t('log.feed.side.label')}
          />
          <Text style={s.muted}>{t('log.feed.fedFor')}</Text>
          <Stepper
            value={form.breastMinutes}
            onChange={(breastMinutes) => update({ breastMinutes })}
            step={BREAST_MINUTES.step}
            min={BREAST_MINUTES.min}
            max={BREAST_MINUTES.max}
            unit={t('log.feed.minutes')}
            accessibilityLabel={t('log.feed.fedFor')}
          />
        </>
      )}
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
