import { useTranslation } from 'react-i18next';
import { SectionList, StyleSheet, Text, View } from 'react-native';

import { HISTORY_GROUPS } from '@/domain/activities';
import type { EntryRow as Row } from '@/domain/entries/describeEntry';
import { Button, Chip, EmptyState, EntryRow, ScreenTitle } from '@/ui/primitives';
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
  const { days, groups, toggle, clear, hasAnyEvents } = useHistory();

  return (
    <SectionList
      testID="history-list"
      sections={days}
      keyExtractor={(row) => row.id}
      initialNumToRender={INITIAL_ROWS}
      stickySectionHeadersEnabled
      contentContainerStyle={s.content}
      ListHeaderComponent={
        <>
          <ScreenTitle title={t('tabs.history')} />
          <View
            style={s.chips}
            accessibilityRole="toolbar"
            accessibilityLabel={t('history.filters')}
          >
            {HISTORY_GROUPS.map((group) => (
              <Chip
                key={group}
                label={t(`history.group.${group}`)}
                selected={groups.has(group)}
                fill="card"
                onPress={() => toggle(group)}
              />
            ))}
          </View>
        </>
      }
      renderSectionHeader={({ section }) => (
        <Text accessibilityRole="header" style={[theme.type.dayLabel, s.dayHeader]}>
          {section.title}
        </Text>
      )}
      // G: each day's entries in one white card, a hairline between rows.
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
          {index > 0 && <View style={s.divider} />}
          <EntryRow
            testID={`history-${item.id}`}
            icon={item.icon}
            tone={item.tone}
            lead={item.time}
            title={
              item.summary
                ? t('home.recent.rowSummary', {
                    when: item.time,
                    label: t(item.labelKey),
                    summary: t(item.summary.key, item.summary.values),
                  })
                : t('home.recent.row', { when: item.time, label: t(item.labelKey) })
            }
            detail={item.byYou ? t('home.recent.you') : (item.by ?? t('home.recent.other'))}
            {...(onOpenEntry && {
              onPress: () => onOpenEntry(item.id),
              accessibilityHint: t('entry.openHint'),
            })}
          />
        </View>
      )}
      ListEmptyComponent={
        hasAnyEvents ? (
          <EmptyState
            icon="tab-history"
            title={t('history.emptyFiltered')}
            action={
              <View style={s.emptyAction}>
                <Button variant="secondary" label={t('history.clear')} onPress={clear} />
              </View>
            }
          />
        ) : (
          <EmptyState icon="tab-history" title={t('history.empty')} body={t('history.emptyBody')} />
        )
      }
    />
  );
}

const styles = (theme: Theme) =>
  StyleSheet.create({
    content: {
      paddingHorizontal: theme.spacing.screen,
      paddingBottom: theme.size.tabBarClearance,
    },
    chips: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: theme.spacing.sm,
      paddingVertical: theme.spacing.md,
    },
    // Sticky, so it keeps the page colour behind it while rows scroll under.
    dayHeader: {
      color: theme.palette.textSoft,
      backgroundColor: theme.palette.background,
      paddingTop: theme.spacing.md,
      paddingBottom: theme.spacing.md,
      paddingHorizontal: theme.spacing.xs,
    },
    cardRow: { backgroundColor: theme.palette.card, paddingHorizontal: theme.spacing.lg },
    cardTop: {
      borderTopLeftRadius: theme.radius.hero,
      borderTopRightRadius: theme.radius.hero,
      paddingTop: theme.spacing.xs,
    },
    cardBottom: {
      borderBottomLeftRadius: theme.radius.hero,
      borderBottomRightRadius: theme.radius.hero,
      paddingBottom: theme.spacing.xs,
    },
    divider: { height: theme.size.borderThin, backgroundColor: theme.palette.line },
    emptyAction: { width: theme.size.emptyAction, paddingTop: theme.spacing.xs },
  });
