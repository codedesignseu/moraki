import { useTranslation } from 'react-i18next';
import { SectionList, StyleSheet, Text, View } from 'react-native';

import { HISTORY_GROUPS } from '@/domain/activities';
import type { EntryRow as Row } from '@/domain/entries/describeEntry';
import { Chip, EmptyState, EntryRow } from '@/ui/primitives';
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
        <Text accessibilityRole="header" style={[theme.type.heading, s.dayHeader]}>
          {section.title}
        </Text>
      )}
      // Sage 12: each day's entries in one white card.
      renderItem={({
        item,
        index,
        section,
      }: {
        item: Row;
        index: number;
        section: { data: readonly Row[] };
      }) => (
        <View
          style={[
            s.cardRow,
            index === 0 && s.cardTop,
            index === section.data.length - 1 && s.cardBottom,
          ]}
        >
          <EntryRow
            testID={`history-${item.id}`}
            title={t(item.labelKey)}
            detail={item.summary ? t(item.summary.key, item.summary.values) : undefined}
            meta={[
              item.time,
              item.byYou ? t('home.recent.you') : (item.by ?? t('home.recent.other')),
            ]}
            {...(onOpenEntry && {
              onPress: () => onOpenEntry(item.id),
              accessibilityHint: t('entry.openHint'),
            })}
          />
        </View>
      )}
      ListEmptyComponent={
        <EmptyState
          icon="tab-history"
          colour="sleep"
          title={t(hasAnyEvents ? 'history.emptyFiltered' : 'history.empty')}
        />
      }
    />
  );
}

const styles = (theme: Theme) =>
  StyleSheet.create({
    content: { paddingHorizontal: theme.spacing.screen, paddingBottom: theme.spacing.xl },
    chips: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: theme.spacing.sm,
      paddingVertical: theme.spacing.md,
    },
    dayHeader: {
      backgroundColor: theme.palette.background,
      paddingTop: theme.spacing.lg,
      paddingBottom: theme.spacing.sm,
    },
    cardRow: { backgroundColor: theme.palette.card, paddingHorizontal: theme.spacing.lg },
    cardTop: {
      borderTopLeftRadius: theme.radius.card,
      borderTopRightRadius: theme.radius.card,
      paddingTop: theme.spacing.sm,
    },
    cardBottom: {
      borderBottomLeftRadius: theme.radius.card,
      borderBottomRightRadius: theme.radius.card,
      paddingBottom: theme.spacing.sm,
    },
  });
