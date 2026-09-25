import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet } from 'react-native';

import { useEventsRepository } from '@/db/react';
import { useUndoableSaves } from '@/db/undo';
import type { DiaperPayload } from '@/domain/activities/diaper';
import { formatDateTime } from '@/domain/time/formatDateTime';
import { dateLocale } from '@/i18n';
import { deviceTimeZone } from '@/ui/deviceTimeZone';
import { Button, DateTimeField, TimeShiftField } from '@/ui/primitives';
import { useTheme, type Theme } from '@/ui/theme';

type Kind = DiaperPayload['kind'];

const MINUTE_MS = 60_000;

/**
 * One tap saves: each kind is its own button, logged at the time the sheet
 * opened. A change noticed later can be given its own time with the picker,
 * which leaves the one-tap case alone (P3-F10). With `entryId` it edits that
 * entry instead: move its time, then tap the kind (P1-12).
 */
export function DiaperSheet({ onDone, entryId }: { onDone: () => void; entryId?: string }) {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const s = styles(theme);
  const repository = useEventsRepository();
  const saves = useUndoableSaves(repository);
  const [openedAt] = useState(Date.now);
  const [at, setAt] = useState(openedAt);
  const [entry] = useState(() => (entryId ? repository.get(entryId) : null));
  const [shift, setShift] = useState(0);
  const tz = deviceTimeZone();

  const kinds: { value: Kind; label: string }[] = [
    { value: 'wet', label: t('log.diaper.wet') },
    { value: 'dirty', label: t('log.diaper.dirty') },
    { value: 'both', label: t('log.diaper.both') },
  ];

  function log(kind: Kind) {
    if (entry) {
      const before = (entry.payload as { kind: Kind }).kind;
      const changes = {
        ...(kind !== before && { payload: { kind } }),
        ...(shift !== 0 && { occurredAt: entry.occurredAt + shift * MINUTE_MS }),
      };
      if (Object.keys(changes).length > 0) {
        saves.patch('undo.entryUpdated', [{ id: entry.id, changes }]);
      }
    } else {
      saves.insert('undo.diaperSaved', { type: 'diaper', occurredAt: at, payload: { kind } });
    }
    onDone();
  }

  return (
    <ScrollView contentContainerStyle={s.content}>
      {entry ? (
        <TimeShiftField
          label={t('entry.moveTime')}
          minutes={shift}
          onChange={setShift}
          unit={t('entry.minutes')}
          result={t('entry.newTime', {
            time: formatDateTime(
              entry.occurredAt + shift * MINUTE_MS,
              tz,
              dateLocale(i18n.language),
            ),
          })}
        />
      ) : (
        <DateTimeField
          label={t('log.diaper.when')}
          value={at}
          onChange={setAt}
          display={formatDateTime(at, tz, dateLocale(i18n.language))}
          openLabel={t('log.exactTime')}
          maximumDate={new Date()}
          testID="diaper-when"
        />
      )}
      {kinds.map(({ value, label }) => (
        <Button
          key={value}
          label={label}
          onPress={() => log(value)}
          accessibilityHint={t('log.diaper.hint')}
        />
      ))}
    </ScrollView>
  );
}

const styles = (theme: Theme) =>
  StyleSheet.create({
    content: { padding: theme.spacing.lg, gap: theme.spacing.lg },
  });
