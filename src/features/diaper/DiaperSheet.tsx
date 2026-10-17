import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useEventsRepository } from '@/db/react';
import { useUndoableSaves } from '@/db/undo';
import type { DiaperPayload } from '@/domain/activities/diaper';
import { fieldTime } from '@/domain/time/fieldTime';
import { formatDateTime } from '@/domain/time/formatDateTime';
import { dateLocale } from '@/i18n';
import { formatFieldTime } from '@/i18n/fieldTime';
import { deviceTimeZone } from '@/ui/deviceTimeZone';
import type { IconName } from '@/ui/icons';
import { DateTimeField, IconCircle, TextButton, TimeShiftField } from '@/ui/primitives';
import { useTheme, type Theme } from '@/ui/theme';

type Kind = DiaperPayload['kind'];

const MINUTE_MS = 60_000;

/**
 * One tap saves: each kind is its own button, logged at the time the sheet
 * opened. A change noticed later can be given its own time with the picker,
 * behind "Changed earlier? Pick time" (P3-F10, G4), which leaves the one-tap
 * case alone. With `entryId` it edits that
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
  const [picking, setPicking] = useState(false);
  const tz = deviceTimeZone();
  const locale = dateLocale(i18n.language);

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

  const tiles = (
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
          <IconCircle icon={ICONS[value]} tone="card" size="tile" />
          <Text style={[theme.type.tileLabel, s.tileLabel]}>{label}</Text>
        </Pressable>
      ))}
    </View>
  );

  if (entry) {
    return (
      <ScrollView contentContainerStyle={s.content}>
        <Text style={s.lead}>{t('log.diaper.tapOne')}</Text>
        {tiles}
        <TimeShiftField
          label={t('entry.moveTime')}
          minutes={shift}
          onChange={setShift}
          unit={t('entry.minutes')}
          result={t('entry.newTime', {
            time: formatDateTime(entry.occurredAt + shift * MINUTE_MS, tz, locale),
          })}
        />
      </ScrollView>
    );
  }

  // G4: one tap saves at the time the sheet opened. A change noticed later
  // first opens the time field (G: sheets/diaper-time), then the tap saves.
  return (
    <ScrollView contentContainerStyle={s.content}>
      {picking ? (
        <>
          <DateTimeField
            label={t('log.diaper.when')}
            value={at}
            onChange={setAt}
            display={formatFieldTime(t, fieldTime(at, openedAt, tz, locale))}
            openLabel={t('log.exactTime')}
            maximumDate={new Date()}
            testID="diaper-when"
          />
          <Text style={s.lead}>{t('log.diaper.thenTap')}</Text>
          {tiles}
        </>
      ) : (
        <>
          <Text style={s.lead}>{t('log.diaper.tapOne')}</Text>
          {tiles}
          <TextButton
            label={t('log.diaper.pickTime')}
            onPress={() => setPicking(true)}
            align="center"
          />
        </>
      )}
    </ScrollView>
  );
}

const styles = (theme: Theme) =>
  StyleSheet.create({
    content: {
      paddingHorizontal: theme.spacing.screen,
      paddingTop: theme.spacing.section,
      paddingBottom: theme.spacing.xl,
      gap: theme.spacing.section,
    },
    lead: { ...theme.type.detail, color: theme.palette.textSoft },
    tiles: { flexDirection: 'row', gap: theme.spacing.sm },
    // G sheets/diaper: 132 high, corner 26, the white icon circle and the name centred.
    tile: {
      flex: 1,
      minHeight: theme.size.tile,
      borderRadius: theme.radius.card,
      padding: theme.spacing.sm,
      alignItems: 'center',
      justifyContent: 'center',
      gap: theme.spacing.grid,
      backgroundColor: theme.palette.diaper,
    },
    pressed: { opacity: theme.opacity.pressed },
    tileLabel: { color: theme.palette.ink, textAlign: 'center' },
  });
