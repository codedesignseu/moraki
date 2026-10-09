import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState, type ComponentType } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { useEventsRepository } from '@/db/react';
import { useUndoableSaves } from '@/db/undo';
import { getActivity, type EventType } from '@/domain/activities';
import { AppointmentSheet } from '@/features/appointments/AppointmentSheet';
import { DiaperSheet } from '@/features/diaper/DiaperSheet';
import { FeedSheet } from '@/features/feed/FeedSheet';
import { HealthSheet } from '@/features/health/HealthSheet';
import { MedicationSheet } from '@/features/health/MedicationSheet';
import { SleepSheet } from '@/features/sleep/SleepSheet';
import { Button } from '@/ui/primitives';
import { useSheetOptions, useTheme, type Theme } from '@/ui/theme';

type Editor = ComponentType<{ entryId: string; onDone: () => void }>;

/**
 * The sheet that edits each activity (P1-12): the same sheet used to log it,
 * opened on the entry. This is where the SDD 15.2 `LogSheet` lives, since
 * domain modules can't import React. Exhaustive over EventType, so a new
 * activity must choose a sheet or null here.
 */
const EDITORS: Record<EventType, Editor | null> = {
  feed_bottle: FeedSheet,
  feed_breast: FeedSheet,
  diaper: DiaperSheet,
  sleep: SleepSheet,
  pump: null,
  stock_adjust: null,
  health: HealthSheet,
  medication: MedicationSheet,
  weight: null,
  appointment: AppointmentSheet,
};

/** Edit or delete one entry (SDD 7 `entry/[id]`), opened by tapping its row. */
export default function EditEntry() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t: typedT } = useTranslation();
  const t = typedT as unknown as (key: string) => string;
  const router = useRouter();
  const theme = useTheme();
  const sheet = useSheetOptions();
  const s = styles(theme);
  const repository = useEventsRepository();
  const saves = useUndoableSaves(repository);
  const [entry] = useState(() => repository.get(id));

  if (!entry) {
    return (
      <View style={s.screen}>
        <Stack.Screen options={{ ...sheet }} />
        <Text style={theme.text.body}>{t('entry.gone')}</Text>
      </View>
    );
  }

  const Editor = EDITORS[entry.type];
  // A combined feed is one thing: deleting either part deletes both (SDD 4.1).
  const ids =
    entry.groupId === null
      ? [entry.id]
      : repository
          .list()
          .filter((e) => e.groupId === entry.groupId)
          .map((e) => e.id);

  return (
    <View style={s.screen}>
      <Stack.Screen options={{ title: t(getActivity(entry.type)?.i18nKey ?? ''), ...sheet }} />
      <View style={s.editor}>
        {Editor ? (
          <Editor entryId={entry.id} onDone={() => router.back()} />
        ) : (
          <Text style={[theme.text.body, s.padded]}>{t('entry.notEditable')}</Text>
        )}
      </View>
      <View style={s.padded}>
        <Button
          label={t('entry.delete')}
          variant="secondary"
          onPress={() => {
            saves.remove('undo.entryDeleted', ids);
            router.back();
          }}
        />
      </View>
    </View>
  );
}

const styles = (theme: Theme) =>
  StyleSheet.create({
    // Sage sheet, by analogy with the log sheets: card colour, screen edge.
    screen: { flex: 1, backgroundColor: theme.palette.card },
    editor: { flex: 1 },
    padded: { padding: theme.spacing.screen },
  });
