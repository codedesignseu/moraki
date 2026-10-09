import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text } from 'react-native';

import { useEventsRepository } from '@/db/react';
import { useUndoableSaves } from '@/db/undo';
import { formatClock } from '@/domain/time/formatClock';
import { formatDateTime } from '@/domain/time/formatDateTime';
import { dateLocale } from '@/i18n';
import { deviceTimeZone } from '@/ui/deviceTimeZone';
import { Button, Stepper, TimeShiftField } from '@/ui/primitives';
import { useTheme, type Theme } from '@/ui/theme';

import { PAST_SLEEP } from './useSleepSheet';

const MINUTE_MS = 60_000;

/**
 * Edits a logged sleep (P1-12): move its start, and for a finished sleep how
 * long it lasted. Nothing can end after now, and a running sleep can't start
 * in the future.
 */
export function SleepEditForm({ entryId, onDone }: { entryId: string; onDone: () => void }) {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const s = styles(theme);
  const repository = useEventsRepository();
  const saves = useUndoableSaves(repository);
  const tz = deviceTimeZone();
  const [openedAt] = useState(Date.now);
  const [entry] = useState(() => repository.get(entryId));
  const [shift, setShift] = useState(0);
  const [minutes, setMinutes] = useState(() =>
    entry?.endedAt == null ? 0 : Math.round((entry.endedAt - entry.occurredAt) / MINUTE_MS),
  );
  if (!entry) return null;

  const ended = entry.endedAt !== null;
  const start = entry.occurredAt + shift * MINUTE_MS;
  const minutesToNow = (from: number) => Math.floor((openedAt - from) / MINUTE_MS);
  const maxShift = ended
    ? minutesToNow(entry.occurredAt + minutes * MINUTE_MS)
    : minutesToNow(entry.occurredAt);
  const maxMinutes = minutesToNow(start);
  const end = start + minutes * MINUTE_MS;

  function save() {
    const changes = {
      ...(shift !== 0 && { occurredAt: start }),
      ...(ended && end !== entry?.endedAt && { endedAt: end }),
    };
    if (entry && Object.keys(changes).length > 0) {
      saves.patch('undo.entryUpdated', [{ id: entry.id, changes }]);
    }
    onDone();
  }

  return (
    <ScrollView contentContainerStyle={s.content}>
      <TimeShiftField
        label={t('entry.moveStart')}
        minutes={shift}
        onChange={setShift}
        max={maxShift}
        unit={t('entry.minutes')}
        result={t('entry.started', { time: formatDateTime(start, tz, dateLocale(i18n.language)) })}
      />
      {ended && (
        <>
          <Text style={s.muted}>{t('log.sleep.past.duration')}</Text>
          <Stepper
            value={minutes}
            onChange={setMinutes}
            step={PAST_SLEEP.step}
            min={PAST_SLEEP.duration.min}
            max={maxMinutes}
            unit={t('log.sleep.past.minutes')}
            accessibilityLabel={t('log.sleep.past.duration')}
          />
          <Text style={theme.text.body}>{t('entry.ended', { time: formatClock(end, tz) })}</Text>
        </>
      )}
      <Button label={t('log.save')} onPress={save} />
    </ScrollView>
  );
}

const styles = (theme: Theme) =>
  StyleSheet.create({
    // By analogy with the 08 and 11 sheets: screen edge, Sage detail labels.
    content: { padding: theme.spacing.screen, gap: theme.spacing.lg },
    muted: { ...theme.type.detail, color: theme.palette.textSoft },
  });
