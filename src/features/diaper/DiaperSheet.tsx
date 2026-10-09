import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useEventsRepository } from '@/db/react';
import { useUndoableSaves } from '@/db/undo';
import type { DiaperPayload } from '@/domain/activities/diaper';
import { formatDateTime } from '@/domain/time/formatDateTime';
import { dateLocale } from '@/i18n';
import { deviceTimeZone } from '@/ui/deviceTimeZone';
import type { IconName } from '@/ui/icons';
import { DateTimeField, Icon, TimeShiftField } from '@/ui/primitives';
import { useTheme, type Theme } from '@/ui/theme';

type Kind = DiaperPayload['kind'];

const MINUTE_MS = 60_000;

/**
 * One tap saves: each kind is its own button, logged at the time the sheet
 * opened. A change noticed later can be given its own time with the picker,
 * which leaves the one-tap case alone (P3-F10). With `entryId` it edits that
 * entry instead: move its time, then tap the kind (P1-12).
 */
const ICONS: Record<Kind, IconName> = {
  wet: 'diaper-wet',
  dirty: 'diaper-dirty',
  both: 'diaper-both',
};

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
      {/* Sage 10: one tap on a tile saves it; undo follows, no confirm. */}
      <View style={s.tiles}>
        {kinds.map(({ value, label }) => (
          <Pressable
            key={value}
            onPress={() => log(value)}
            accessibilityRole="button"
            accessibilityLabel={label}
            accessibilityHint={t('log.diaper.hint')}
            style={({ pressed }) => [s.tile, pressed && s.pressed]}
          >
            <Icon name={ICONS[value]} size={theme.size.iconTile} color={theme.palette.onTile} />
            <Text style={[theme.type.tileTitle, s.tileLabel]}>{label}</Text>
          </Pressable>
        ))}
      </View>
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
    </ScrollView>
  );
}

const styles = (theme: Theme) =>
  StyleSheet.create({
    content: { padding: theme.spacing.screen, gap: theme.spacing.lg },
    tiles: { flexDirection: 'row', gap: theme.spacing.md },
    tile: {
      flex: 1,
      minHeight: theme.size.choiceTile,
      borderRadius: theme.radius.card,
      padding: theme.spacing.lg,
      justifyContent: 'space-between',
      gap: theme.spacing.sm,
      backgroundColor: theme.palette.diaper,
    },
    pressed: { opacity: theme.opacity.pressed },
    tileLabel: { color: theme.palette.onTile },
  });
