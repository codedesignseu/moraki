import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { BREAST_MINUTES, type FeedKind, type FeedPrefill } from '@/domain/activities';
import {
  Button,
  ChoiceButtons,
  DateTimeField,
  FieldLabel,
  Segmented,
  StatusPill,
  Stepper,
  TimeShiftField,
} from '@/ui/primitives';
import type { ChoiceOption } from '@/ui/primitives';
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
  const {
    form,
    when,
    update,
    save,
    editing,
    shift,
    setShift,
    newStart,
    stock,
    at,
    atLabel,
    setAt,
  } = useFeedSheet(entryId);

  // G: each kind in its tile colour, bottle butter, breast pink, mixed green.
  const kinds: ChoiceOption<FeedKind>[] = [
    { value: 'bottle', label: t('log.feed.kind.bottle'), tone: 'feed' },
    { value: 'breast', label: t('log.feed.kind.breast'), tone: 'sleep' },
    { value: 'mixed', label: t('log.feed.kind.mixed'), tone: 'pump' },
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
  // "Not from a store" is a choice here but the absence of a key in the
  // payload, so the two are mapped at the edge rather than in the event.
  const froms = [
    { value: 'none' as const, label: t('log.feed.from.none') },
    { value: 'fridge' as const, label: t('log.feed.from.fridge') },
    { value: 'freezer' as const, label: t('log.feed.from.freezer') },
  ];
  const hasBottle = form.kind !== 'breast';
  const hasBreast = form.kind !== 'bottle';

  return (
    <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
      <ChoiceButtons
        options={kinds}
        value={form.kind}
        onChange={(kind) => update({ kind })}
        accessibilityLabel={t('log.feed.kind.label')}
        // A logged feed keeps its kind; to change it, delete and log again.
        disabled={editing}
      />
      {editing ? (
        <TimeShiftField
          label={t('entry.moveTime')}
          minutes={shift}
          onChange={setShift}
          unit={t('entry.minutes')}
          result={t('entry.newTime', { time: newStart })}
        />
      ) : (
        <View style={s.field}>
          {/* The fast path is logging it now; this is for writing one up
              later (P3-F7). */}
          <DateTimeField
            label={t('log.feed.when')}
            value={at}
            onChange={setAt}
            display={atLabel}
            openLabel={t('log.exactTime')}
            maximumDate={new Date()}
            testID="feed-when"
          />
          <StatusPill
            label={'at' in when ? t('log.time', { time: when.at }) : t('log.feed.range', when)}
          />
        </View>
      )}
      {hasBreast && (
        <>
          <View style={s.field}>
            <FieldLabel label={t('log.feed.side.label')} />
            <Segmented
              options={sides}
              value={form.side}
              onChange={(side) => update({ side })}
              accessibilityLabel={t('log.feed.side.label')}
            />
          </View>
          <View style={s.field}>
            <FieldLabel label={t('log.feed.fedFor')} />
            <Stepper
              value={form.breastMinutes}
              onChange={(breastMinutes) => update({ breastMinutes })}
              step={BREAST_MINUTES.step}
              min={BREAST_MINUTES.min}
              max={BREAST_MINUTES.max}
              unit={t('log.feed.minutes')}
              accessibilityLabel={t('log.feed.fedFor')}
            />
          </View>
        </>
      )}
      {hasBottle && (
        <>
          <View style={s.field}>
            <FieldLabel label={t('log.feed.amount')} />
            <Stepper
              value={form.ml}
              onChange={(ml) => update({ ml })}
              step={ML_STEP}
              min={ML_MIN}
              max={ML_MAX}
              unit={t('log.feed.unit')}
              accessibilityLabel={t('log.feed.amount')}
            />
          </View>
          <View style={s.field}>
            <FieldLabel label={t('log.feed.milk.label')} />
            <Segmented
              options={milks}
              value={form.milk}
              onChange={(milk) => update({ milk })}
              accessibilityLabel={t('log.feed.milk.label')}
            />
          </View>
          {form.milk !== 'formula' && (
            <View style={s.field}>
              <FieldLabel label={t('log.feed.from.label')} />
              <Segmented
                options={froms}
                value={form.fromStock ?? 'none'}
                onChange={(from) => update({ fromStock: from === 'none' ? null : from })}
                accessibilityLabel={t('log.feed.from.label')}
              />
              <Text style={s.soft}>
                {t('log.feed.from.have', { fridge: stock.fridge.ml, freezer: stock.freezer.ml })}
              </Text>
            </View>
          )}
        </>
      )}
      <View style={s.footer}>
        <Button
          label={editing ? t('entry.saveChanges') : t('log.feed.save')}
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
    // G sheets/feed-*: 14 between blocks, the screen edge at the sides.
    content: {
      flexGrow: 1,
      paddingHorizontal: theme.spacing.screen,
      paddingTop: theme.spacing.section,
      paddingBottom: theme.spacing.xl,
      gap: theme.spacing.section,
    },
    // A small label and its control.
    field: { gap: theme.spacing.sm },
    soft: { ...theme.type.small, color: theme.palette.textSoft },
    // Save sits at the foot of a short sheet and after the last field of a long one.
    footer: { marginTop: 'auto' },
  });
