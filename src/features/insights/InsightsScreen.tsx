import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { BarChart, Card } from '@/ui/primitives';
import { useTheme, type Theme } from '@/ui/theme';

import { useInsights } from './useInsights';

/** Trends over the last 7 days (SDD 7). Renders the view model and nothing else. */
export function InsightsScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const s = styles(theme);
  const insights = useInsights();

  return (
    <ScrollView contentContainerStyle={s.content}>
      <Card testID="insights-bottle">
        <Text style={theme.text.heading}>{t('insights.bottle.title')}</Text>
        <BarChart bars={insights.bottleBars} testID="insights-bottle-chart" />
        <Text style={theme.text.body}>{t('insights.total', { value: insights.bottleTotal })}</Text>
      </Card>

      {insights.breastBars && (
        <Card testID="insights-breast">
          <Text style={theme.text.heading}>{t('insights.breast.title')}</Text>
          <BarChart bars={insights.breastBars} testID="insights-breast-chart" />
          <Text style={theme.text.body}>
            {t('insights.total', { value: insights.breastTotal })}
          </Text>
        </Card>
      )}

      <Card testID="insights-averages">
        <Text style={theme.text.heading}>{t('insights.averages.title')}</Text>
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
        <Text style={theme.text.heading}>{t('insights.days.title')}</Text>
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

const styles = (theme: Theme) =>
  StyleSheet.create({
    content: { padding: theme.spacing.lg, gap: theme.spacing.lg },
    muted: { ...theme.text.label, color: theme.colors.textMuted },
    figure: { gap: theme.spacing.xs },
    row: { flexDirection: 'row', gap: theme.spacing.sm },
    headerCell: { ...theme.text.label, color: theme.colors.textMuted },
    first: { flex: 2 },
    cell: { flex: 1, textAlign: 'right' },
  });
