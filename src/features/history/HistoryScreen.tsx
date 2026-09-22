import { useTranslation } from 'react-i18next';
import { SectionList, StyleSheet, Text, View } from 'react-native';

import { HISTORY_GROUPS } from '@/domain/activities';
import type { EntryRow as Row } from '@/domain/entries/describeEntry';
import { Chip, EntryRow } from '@/ui/primitives';
import { useTheme, type Theme } from '@/ui/theme';

import { useHistory } from './useHistory';

type Translate = (key: string, values?: Record<string, string | number>) => string;

/** How many rows the list draws before scrolling; the rest render on demand. */
export const INITIAL_ROWS = 20;

/** Renders the history view model and nothing else (SDD 15.4). */
export function HistoryScreen({
  onOpenEntry,
}: {
  /** Opens an entry to edit (P1-12). Supplied by app/ so features stay independent. */
  onOpenEntry?: (id: string) => void;
}) {
  const { t: typedT } = useTranslation();
  // Keys from activity modules are checked by the registry completeness test.
  const t = typedT as unknown as Translate;
  const theme = useTheme();
  const s = styles(theme);
  const { days, groups, toggle, hasAnyEvents } = useHistory();

  return (
    <SectionList
      testID="history-list"
      sections={days}
      keyExtractor={(row) => row.id}
      initialNumToRender={INITIAL_ROWS}
      stickySectionHeadersEnabled
      contentContainerStyle={s.content}
      ListHeaderComponent={
        <View style={s.chips} accessibilityRole="toolbar" accessibilityLabel={t('history.filters')}>
          {HISTORY_GROUPS.map((group) => (
            <Chip
              key={group}
              label={t(`history.group.${group}`)}
              selected={groups.has(group)}
              onPress={() => toggle(group)}
            />
          ))}
        </View>
      }
      renderSectionHeader={({ section }) => (
        <Text accessibilityRole="header" style={[theme.text.heading, s.dayHeader]}>
          {section.title}
        </Text>
      )}
      renderItem={({ item }: { item: Row }) => (
        <EntryRow
          testID={`history-${item.id}`}
          title={t(item.labelKey)}
          detail={item.summary ? t(item.summary.key, item.summary.values) : undefined}
          meta={[item.time, t(item.byYou ? 'home.recent.you' : 'home.recent.other')]}
          {...(onOpenEntry && {
            onPress: () => onOpenEntry(item.id),
            accessibilityHint: t('entry.openHint'),
          })}
        />
      )}
      ListEmptyComponent={
        <Text style={s.muted}>{t(hasAnyEvents ? 'history.emptyFiltered' : 'history.empty')}</Text>
      }
    />
  );
}

const styles = (theme: Theme) =>
  StyleSheet.create({
    content: { paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.xl },
    chips: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: theme.spacing.sm,
      paddingVertical: theme.spacing.md,
    },
    dayHeader: {
      backgroundColor: theme.colors.background,
      paddingTop: theme.spacing.lg,
      paddingBottom: theme.spacing.xs,
    },
    muted: { ...theme.text.body, color: theme.colors.textMuted },
  });
