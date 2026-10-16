import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState, type ComponentType } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { useCaregiverNames, useEventsRepository } from '@/db/react';
import { useUndoableSaves } from '@/db/undo';
import { getActivity, type EventType } from '@/domain/activities';
import { fieldTime } from '@/domain/time/fieldTime';
import { AppointmentSheet } from '@/features/appointments/AppointmentSheet';
import { DiaperSheet } from '@/features/diaper/DiaperSheet';
import { FeedSheet } from '@/features/feed/FeedSheet';
import { HealthSheet } from '@/features/health/HealthSheet';
import { MedicationSheet } from '@/features/health/MedicationSheet';
import { ActivitySheetHeader } from '@/features/sheet/ActivitySheetHeader';
import { SleepSheet } from '@/features/sleep/SleepSheet';
import { dateLocale } from '@/i18n';
import { deviceTimeZone } from '@/ui/deviceTimeZone';
import { Button, IconCircle, SheetHeader } from '@/ui/primitives';
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
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const theme = useTheme();
  const sheet = useSheetOptions();
  const s = styles(theme);
  const repository = useEventsRepository();
  const saves = useUndoableSaves(repository);
  const names = useCaregiverNames();
  const [openedAt] = useState(Date.now);
  const [entry] = useState(() => repository.get(id));

  if (!entry) {
    return (
      <View style={s.screen}>
        <Stack.Screen options={{ ...sheet }} />
        <SheetHeader
          icon="tab-history"
          tone="chip"
          title={t('entry.gone')}
          onClose={() => router.back()}
          closeLabel={t('common.close')}
        />
      </View>
    );
  }

  const Editor = EDITORS[entry.type];
  const locale = dateLocale(i18n.language);
  // The module names its own label key, which the typed t can't check.
  const label = (t as unknown as (key: string) => string)(getActivity(entry.type)?.i18nKey ?? '');
  // G: "Edit feed", "Logged 21:40 · Parent 2". The time is the entry's own;
  // another day keeps its date. The name is whoever logged it, when known.
  const title = t('entry.title', { type: label.toLocaleLowerCase(locale) });
  const logged = fieldTime(entry.occurredAt, openedAt, deviceTimeZone(), locale);
  const time = logged.day === 'today' ? logged.clock : logged.text;
  const by = names.get(entry.createdBy);
  const subtitle = by ? t('entry.loggedBy', { time, name: by }) : t('entry.logged', { time });
  // A combined feed is one thing: deleting either part deletes both (SDD 4.1).
  const ids =
    entry.groupId === null
      ? [entry.id]
      : repository
          .list()
          .filter((e) => e.groupId === entry.groupId)
          .map((e) => e.id);
  const remove = (
    <Button
      label={t('entry.delete')}
      accessibilityLabel={t('entry.deleteEntry')}
      variant="secondary"
      icon="delete"
      onPress={() => {
        saves.remove('undo.entryDeleted', ids);
        router.back();
      }}
    />
  );

  return (
    <View style={s.screen}>
      <Stack.Screen options={{ title, ...sheet }} />
      <ActivitySheetHeader
        type={entry.type}
        title={title}
        subtitle={subtitle}
        onClose={() => router.back()}
      />
      {Editor ? (
        <>
          <View style={s.editor}>
            <Editor entryId={entry.id} onDone={() => router.back()} />
          </View>
          <View style={s.foot}>{remove}</View>
        </>
      ) : (
        // G sheets/not-editable, keeping the app's Delete.
        <View style={s.notEditable}>
          <View style={s.panel}>
            <IconCircle icon="private" tone="card" size="row" />
            <Text style={[theme.type.sheetTitle, s.ink]} accessibilityRole="header">
              {t('entry.notEditableTitle')}
            </Text>
            <Text style={[theme.type.detail, s.soft]}>{t('entry.notEditable')}</Text>
          </View>
          <View style={s.actions}>
            {remove}
            <Button label={t('common.close')} variant="secondary" onPress={() => router.back()} />
          </View>
        </View>
      )}
    </View>
  );
}

const styles = (theme: Theme) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: theme.palette.card },
    editor: { flex: 1 },
    // Delete sits under the editor's Save, at the foot of the sheet.
    foot: { paddingHorizontal: theme.spacing.screen, paddingBottom: theme.spacing.xl },
    notEditable: {
      flex: 1,
      paddingHorizontal: theme.spacing.screen,
      paddingTop: theme.spacing.section,
      paddingBottom: theme.spacing.xl,
    },
    panel: {
      backgroundColor: theme.palette.chip,
      borderRadius: theme.radius.panel,
      paddingVertical: theme.spacing.lg,
      paddingHorizontal: theme.spacing.screen,
      gap: theme.spacing.md,
    },
    ink: { color: theme.palette.ink },
    soft: { color: theme.palette.textSoft },
    actions: { marginTop: 'auto', gap: theme.spacing.sm },
  });
