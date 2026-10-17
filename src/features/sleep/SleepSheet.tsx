import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { fieldTime } from '@/domain/time/fieldTime';
import { formatStopwatch } from '@/domain/time/formatStopwatch';
import { dateLocale } from '@/i18n';
import { formatFieldTime } from '@/i18n/fieldTime';
import { deviceTimeZone } from '@/ui/deviceTimeZone';
import {
  Button,
  DateTimeField,
  FieldLabel,
  IconCircle,
  InlineError,
  Stepper,
  TimerText,
} from '@/ui/primitives';
import { useTheme, type Theme } from '@/ui/theme';
import { useNow } from '@/ui/useNow';

import { SleepEditForm } from './SleepEditForm';
import { PAST_SLEEP, useSleepSheet } from './useSleepSheet';

/** The running timer ticks every second, like Home's sleep card. */
const TICK_MS = 1000;

/**
 * Start or stop the running sleep in one tap, or add a sleep that already
 * happened. With `entryId` it edits that sleep instead (P1-12).
 */
export function SleepSheet({ onDone, entryId }: { onDone: () => void; entryId?: string }) {
  if (entryId) return <SleepEditForm entryId={entryId} onDone={onDone} />;
  return <LogSleep onDone={onDone} />;
}

function LogSleep({ onDone }: { onDone: () => void }) {
  const { t, i18n } = useTranslation();
  const tz = deviceTimeZone();
  const locale = dateLocale(i18n.language);
  const theme = useTheme();
  const s = styles(theme);
  const { running, startNow, stop, past } = useSleepSheet();
  const [openedAt] = useState(Date.now);
  const when = (at: number) => formatFieldTime(t, fieldTime(at, openedAt, tz, locale));

  const done = (action: () => unknown) => () => {
    action();
    onDone();
  };

  return (
    <ScrollView contentContainerStyle={s.content}>
      {running ? (
        // G sheets/sleep-running: the sleep card with a live timer, one dark Stop.
        <>
          <View style={s.running} testID="sleep-running">
            <View style={s.centre}>
              <IconCircle icon="sleep" tone="card" size="empty" />
            </View>
            <Text style={[theme.type.lead, s.ink, s.centred]}>
              {t('log.sleep.runningSince', { time: running.startedAt })}
            </Text>
            <RunningTimer startedAt={running.startedAtMs} />
          </View>
          <Button label={t('log.sleep.stop')} onPress={done(() => stop(running.id))} />
        </>
      ) : (
        // G sheets/sleep-idle: the start card in the sleep colour.
        <View style={s.start}>
          <Text style={[theme.type.cardTitle, s.ink]}>{t('log.sleep.startTitle')}</Text>
          <Text style={[theme.type.note, s.soft]}>{t('log.sleep.startBody')}</Text>
          <Button label={t('log.sleep.startNow')} onPress={done(startNow)} />
        </View>
      )}

      <View style={s.past} testID="sleep-past">
        <Text accessibilityRole="header" style={[theme.type.cardTitle, s.ink]}>
          {t('log.sleep.past.title')}
        </Text>
        <View style={s.field}>
          <FieldLabel label={t('log.sleep.past.startedAgo')} />
          <Stepper
            value={past.startedAgo}
            onChange={past.setStartedAgo}
            step={PAST_SLEEP.step}
            min={PAST_SLEEP.startedAgo.min}
            max={PAST_SLEEP.startedAgo.max}
            unit={t('log.sleep.past.minutes')}
            accessibilityLabel={t('log.sleep.past.startedAgo')}
          />
        </View>
        <View style={s.field}>
          <FieldLabel label={t('log.sleep.past.duration')} />
          <Stepper
            value={past.duration}
            onChange={past.setDuration}
            step={PAST_SLEEP.step}
            min={PAST_SLEEP.duration.min}
            max={past.maxDuration}
            unit={t('log.sleep.past.minutes')}
            accessibilityLabel={t('log.sleep.past.duration')}
          />
        </View>
        <Text style={[theme.type.body, s.ink]}>
          {t('log.sleep.past.range', { from: past.from, to: past.to })}
        </Text>

        {/* Writing one up afterwards: set both ends and let the app do the
            arithmetic, rather than working back from now (P3-F7). */}
        <Text style={[theme.type.note, s.soft]}>{t('log.sleep.exactHint')}</Text>
        <View style={s.pair}>
          <View style={s.half}>
            <DateTimeField
              label={t('log.sleep.startedAt')}
              value={past.start}
              onChange={past.setStart}
              display={when(past.start)}
              openLabel={t('log.exactTime')}
              maximumDate={new Date()}
              testID="sleep-start"
            />
          </View>
          <View style={s.half}>
            <DateTimeField
              label={t('log.sleep.endedAt')}
              value={past.end}
              onChange={past.setEnd}
              display={when(past.end)}
              openLabel={t('log.exactTime')}
              maximumDate={new Date()}
              invalid={past.endsBeforeItStarts}
              testID="sleep-end"
            />
          </View>
        </View>
        {past.endsBeforeItStarts && (
          <InlineError
            message={t('log.sleep.backwards')}
            prefix={t('common.error')}
            testID="sleep-backwards"
          />
        )}

        <Button
          label={t('log.sleep.past.save')}
          variant="secondary"
          disabled={past.endsBeforeItStarts}
          onPress={done(past.save)}
        />
      </View>
    </ScrollView>
  );
}

/** Mounted only while a sleep runs, so the 1 s tick stops with it. */
function RunningTimer({ startedAt }: { startedAt: number }) {
  const now = useNow(TICK_MS);
  return <TimerText text={formatStopwatch(now - startedAt)} />;
}

const styles = (theme: Theme) =>
  StyleSheet.create({
    content: {
      paddingHorizontal: theme.spacing.screen,
      paddingTop: theme.spacing.section,
      paddingBottom: theme.spacing.xl,
      gap: theme.spacing.section,
    },
    ink: { color: theme.palette.ink },
    soft: { color: theme.palette.textSoft },
    centred: { textAlign: 'center' },
    centre: { alignItems: 'center' },
    // G: corner 28, padding 22 (the scale's 24), 6 between the circle, line and timer.
    running: {
      backgroundColor: theme.palette.sleep,
      borderRadius: theme.radius.tile,
      padding: theme.spacing.xl,
      gap: theme.spacing.tile,
    },
    // G: corner 24, padding 16 by 18, 12 between the lines.
    start: {
      backgroundColor: theme.palette.sleep,
      borderRadius: theme.radius.stepper,
      paddingVertical: theme.spacing.lg,
      paddingHorizontal: theme.spacing.screen,
      gap: theme.spacing.md,
    },
    past: { gap: theme.spacing.section },
    field: { gap: theme.spacing.sm },
    pair: { flexDirection: 'row', gap: theme.spacing.grid },
    half: { flex: 1 },
  });
