import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { formatDateTime } from '@/domain/time/formatDateTime';
import { dateLocale } from '@/i18n';
import { Button, DateTimeField, Icon, Stepper } from '@/ui/primitives';
import { deviceTimeZone } from '@/ui/deviceTimeZone';
import { useTheme, type Theme } from '@/ui/theme';

import { SleepEditForm } from './SleepEditForm';
import { PAST_SLEEP, useSleepSheet } from './useSleepSheet';

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

  const done = (action: () => unknown) => () => {
    action();
    onDone();
  };

  return (
    <ScrollView contentContainerStyle={s.content}>
      {running ? (
        // Sage 11: the running sleep on the sleep colour, one dark Stop.
        <View style={s.hero}>
          <Icon name="sleep" size={theme.size.iconTile} color={theme.palette.onTile} />
          <Text style={[theme.type.heading, s.onTile]}>
            {t('log.sleep.runningSince', { time: running.startedAt })}
          </Text>
          <Button label={t('log.sleep.stop')} onPress={done(() => stop(running.id))} />
        </View>
      ) : (
        <Button label={t('log.sleep.startNow')} onPress={done(startNow)} />
      )}

      <View style={s.panel} testID="sleep-past">
        <Text style={theme.type.heading}>{t('log.sleep.past.title')}</Text>
        <Text style={s.muted}>{t('log.sleep.past.startedAgo')}</Text>
        <Stepper
          value={past.startedAgo}
          onChange={past.setStartedAgo}
          step={PAST_SLEEP.step}
          min={PAST_SLEEP.startedAgo.min}
          max={PAST_SLEEP.startedAgo.max}
          unit={t('log.sleep.past.minutes')}
          accessibilityLabel={t('log.sleep.past.startedAgo')}
        />
        <Text style={s.muted}>{t('log.sleep.past.duration')}</Text>
        <Stepper
          value={past.duration}
          onChange={past.setDuration}
          step={PAST_SLEEP.step}
          min={PAST_SLEEP.duration.min}
          max={past.maxDuration}
          unit={t('log.sleep.past.minutes')}
          accessibilityLabel={t('log.sleep.past.duration')}
        />
        <Text style={theme.text.body}>
          {t('log.sleep.past.range', { from: past.from, to: past.to })}
        </Text>

        {/* Writing one up afterwards: set both ends and let the app do the
            arithmetic, rather than working back from now (P3-F7). */}
        <Text style={s.muted}>{t('log.sleep.exactHint')}</Text>
        <DateTimeField
          label={t('log.sleep.startedAt')}
          value={past.start}
          onChange={past.setStart}
          display={formatDateTime(past.start, tz, locale)}
          openLabel={t('log.exactTime')}
          maximumDate={new Date()}
          testID="sleep-start"
        />
        <DateTimeField
          label={t('log.sleep.endedAt')}
          value={past.end}
          onChange={past.setEnd}
          display={formatDateTime(past.end, tz, locale)}
          openLabel={t('log.exactTime')}
          maximumDate={new Date()}
          testID="sleep-end"
        />
        {past.endsBeforeItStarts && (
          <Text style={s.alert} accessibilityRole="alert" testID="sleep-backwards">
            {t('log.sleep.backwards')}
          </Text>
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

const styles = (theme: Theme) =>
  StyleSheet.create({
    content: { padding: theme.spacing.screen, gap: theme.spacing.lg },
    hero: {
      backgroundColor: theme.palette.sleep,
      borderRadius: theme.radius.tile,
      padding: theme.spacing.xl,
      gap: theme.spacing.md,
      alignItems: 'stretch',
    },
    onTile: { color: theme.palette.onTile },
    // Past sleep, by analogy with the 08 card: chip colour on the white sheet.
    panel: {
      backgroundColor: theme.palette.chip,
      borderRadius: theme.radius.tile,
      padding: theme.spacing.screen,
      gap: theme.spacing.md,
    },
    muted: { ...theme.type.detail, color: theme.palette.textSoft },
    alert: { ...theme.type.body, color: theme.palette.invalid },
  });
