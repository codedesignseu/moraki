import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import type { IconName } from '@/ui/icons';
import { BarChart, Card, Icon } from '@/ui/primitives';
import { useTheme, type Theme } from '@/ui/theme';

import { useInsights } from './useInsights';

/** Trends over the last 7 days (SDD 7). Renders the view model and nothing else. */
export function InsightsScreen({ weight }: { weight?: ReactNode }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const s = styles(theme);
  const insights = useInsights();

  return (
    <ScrollView contentContainerStyle={s.content}>
      <Card testID="insights-bottle">
        <CardTitle icon="feed" title={t('insights.bottle.title')} />
        <BarChart bars={insights.bottleBars} testID="insights-bottle-chart" />
        <Text style={theme.text.body}>{t('insights.total', { value: insights.bottleTotal })}</Text>
      </Card>

      {insights.breastBars && (
        <Card testID="insights-breast">
          <CardTitle icon="feed" title={t('insights.breast.title')} />
          <BarChart bars={insights.breastBars} testID="insights-breast-chart" />
          <Text style={theme.text.body}>
            {t('insights.total', { value: insights.breastTotal })}
          </Text>
        </Card>
      )}

      {/* The weight card is its own feature, wired in by app/ (SDD 15). */}
      {weight}

      <Card testID="insights-averages">
        <CardTitle icon="tab-insights" title={t('insights.averages.title')} />
        <Figure
          label={t('insights.averages.bottle')}
          value={insights.averageBottle ?? t('insights.none')}
        />
        <Figure
          label={t('insights.averages.interval')}
          value={insights.averageInterval ?? t('insights.none')}
        />
      </Card>

      <Card testID="insights-days">
        <CardTitle icon="time" title={t('insights.days.title')} />
        <Row
          header
          cells={[
            t('insights.days.day'),
            t('insights.days.feeds'),
            t('insights.days.wet'),
            t('insights.days.dirty'),
            t('insights.days.sleep'),
          ]}
        />
        {insights.rows.map((row) => (
          <Row
            key={row.key}
            testID={`insights-day-${row.key}`}
            cells={[row.day, row.feeds, row.wet, row.dirty, row.sleep]}
          />
        ))}
        <Row
          header
          testID="insights-day-total"
          cells={[
            t('insights.days.total'),
            insights.totals.feeds,
            insights.totals.wet,
            insights.totals.dirty,
            insights.totals.sleep,
          ]}
        />
      </Card>
    </ScrollView>
  );
}

function Figure({ label, value }: { label: string; value: string }) {
  const theme = useTheme();
  const s = styles(theme);
  return (
    <View style={s.figure} accessible accessibilityLabel={`${label}: ${value}`}>
      <Text style={s.muted}>{label}</Text>
      <Text style={theme.text.title}>{value}</Text>
    </View>
  );
}

function Row({
  cells,
  header = false,
  testID,
}: {
  cells: (string | number)[];
  header?: boolean;
  testID?: string;
}) {
  const theme = useTheme();
  const s = styles(theme);
  return (
    <View style={s.row} testID={testID}>
      {cells.map((cell, i) => (
        <Text key={i} style={[header ? s.headerCell : theme.text.body, i === 0 ? s.first : s.cell]}>
          {cell}
        </Text>
      ))}
    </View>
  );
}

/** Sage 13 card heading: icon and title. */
function CardTitle({ icon, title }: { icon: IconName; title: string }) {
  const theme = useTheme();
  const s = styles(theme);
  return (
    <View style={s.titleRow}>
      <Icon name={icon} />
      <Text style={[theme.type.tileTitle, s.title]}>{title}</Text>
    </View>
  );
}

const styles = (theme: Theme) =>
  StyleSheet.create({
    content: { padding: theme.spacing.screen, gap: theme.spacing.lg },
    titleRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
    title: { flex: 1 },
    muted: { ...theme.text.label, color: theme.colors.textMuted },
    figure: { gap: theme.spacing.xs },
    row: { flexDirection: 'row', gap: theme.spacing.sm },
    headerCell: { ...theme.text.label, color: theme.colors.textMuted },
    first: { flex: 2 },
    cell: { flex: 1, textAlign: 'right' },
  });
