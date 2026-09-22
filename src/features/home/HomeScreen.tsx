import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { Card, TimerText } from '@/ui/primitives';
import { useTheme, type Theme } from '@/ui/theme';

import { useHome, type RecentRow } from './useHome';

type Translate = (key: string, values?: Record<string, string | number>) => string;

/** Renders the home view model and nothing else (SDD 15.4). */
export function HomeScreen({ actions }: { actions?: ReactNode }) {
  const { t: typedT } = useTranslation();
  // Keys from activity modules are checked by the registry completeness test.
  const t = typedT as unknown as Translate;
  const home = useHome();
  const theme = useTheme();
  const s = styles(theme);

  return (
    <ScrollView contentContainerStyle={s.screen}>
      <Card testID="home-timer">
        <Text style={s.muted}>{t('home.timer.label')}</Text>
        {home.sinceLastFeed === null ? (
          <Text style={theme.text.heading}>{t('home.timer.none')}</Text>
        ) : (
          <TimerText text={home.sinceLastFeed} />
        )}
        {home.nextSide && (
          <Text style={theme.text.body}>{t(`home.nextSide.${home.nextSide}`)}</Text>
        )}
        {home.reminder && (
          <Text style={s.muted}>
            {t(home.reminder.passed ? 'home.reminder.passed' : 'home.reminder.upcoming', {
              time: home.reminder.time,
            })}
          </Text>
        )}
      </Card>

      {actions && <View style={s.actions}>{actions}</View>}

      <Card testID="home-today">
        <Text style={theme.text.heading}>{t('home.today.title')}</Text>
        <View style={s.strip}>
          <Stat label={t('home.today.feeds')} value={home.today.feeds} />
          <Stat label={t('home.today.ml')} value={home.today.ml} />
          <Stat label={t('home.today.wet')} value={home.today.wet} />
          <Stat label={t('home.today.dirty')} value={home.today.dirty} />
        </View>
        <Text style={theme.text.body}>
          {t('home.today.sleep24h', { duration: home.today.sleep })}
        </Text>
      </Card>

      <Card testID="home-recent">
        <Text style={theme.text.heading}>{t('home.recent.title')}</Text>
        {home.recent.length === 0 ? (
          <Text style={s.muted}>{t('home.recent.empty')}</Text>
        ) : (
          home.recent.map((row) => <Row key={row.id} row={row} t={t} />)
        )}
      </Card>
    </ScrollView>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  const theme = useTheme();
  const s = styles(theme);
  return (
    <View style={s.stat} accessible accessibilityLabel={`${label}: ${value}`}>
      <Text style={theme.text.title}>{value}</Text>
      <Text style={s.muted}>{label}</Text>
    </View>
  );
}

function Row({ row, t }: { row: RecentRow; t: Translate }) {
  const theme = useTheme();
  const s = styles(theme);
  const when =
    row.daysAgo === 0
      ? row.time
      : row.daysAgo === 1
        ? t('home.recent.yesterday', { time: row.time })
        : t('home.recent.daysAgo', { count: row.daysAgo, time: row.time });
  return (
    <View style={s.row} testID={`recent-${row.id}`}>
      <View style={s.rowMain}>
        <Text style={theme.text.bodyStrong}>{t(row.labelKey)}</Text>
        {row.summary && (
          <Text style={theme.text.body}>{t(row.summary.key, row.summary.values)}</Text>
        )}
      </View>
      <View style={s.rowMeta}>
        <Text style={s.muted}>{when}</Text>
        <Text style={s.muted}>{t(row.byYou ? 'home.recent.you' : 'home.recent.other')}</Text>
      </View>
    </View>
  );
}

const styles = (theme: Theme) =>
  StyleSheet.create({
    screen: { padding: theme.spacing.lg, gap: theme.spacing.lg },
    actions: { gap: theme.spacing.md },
    muted: { ...theme.text.label, color: theme.colors.textMuted },
    strip: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.lg },
    stat: { minWidth: theme.size.touchTargetLarge, alignItems: 'flex-start' },
    row: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      borderTopWidth: theme.size.borderThin,
      borderTopColor: theme.colors.divider,
    },
    rowMain: { flex: 1 },
    rowMeta: { alignItems: 'flex-end' },
  });
