import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text } from 'react-native';

import type { FeedKind, FeedPrefill } from '@/domain/activities';
import { Button, Segmented, Stepper } from '@/ui/primitives';
import { useTheme, type Theme } from '@/ui/theme';

import { useFeedSheet } from './useFeedSheet';

const ML_STEP = 10;
const ML_MIN = 10;
const ML_MAX = 400;

/** Log a bottle, breast or mixed feed. Opens prefilled; Save is the only required tap. */
export function FeedSheet({ onDone }: { onDone: () => void }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const s = styles(theme);
  const { form, time, update, save } = useFeedSheet();

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
      <Text style={s.muted}>{t('log.time', { time })}</Text>
      <Segmented
        options={kinds}
        value={form.kind}
        onChange={(kind) => update({ kind })}
        accessibilityLabel={t('log.feed.kind.label')}
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
        <Segmented
          options={sides}
          value={form.side}
          onChange={(side) => update({ side })}
          accessibilityLabel={t('log.feed.side.label')}
        />
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
