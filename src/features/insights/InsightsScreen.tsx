import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { BarChart, Card, EmptyState, ScreenTitle, StatCell } from '@/ui/primitives';
import { useTheme, type Theme } from '@/ui/theme';

import { useInsights } from './useInsights';

/**
 * Trends over the last 7 days (SDD 7, G tabs/trends). Renders the view model
 * and nothing else. With nothing logged in the window, G's empty state
 * (tabs/trends-empty) stands in for the charts; the weight card stays.
 */
export function InsightsScreen({ weight }: { weight?: ReactNode }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const s = styles(theme);
  const insights = useInsights();

  return (
    <ScrollView contentContainerStyle={s.content}>
      <ScreenTitle
        title={t('tabs.insights')}
        {...(!insights.empty && { subtitle: t('insights.subtitle') })}
      />
      {insights.empty ? (
        <EmptyState
          testID="insights-empty"
          icon="tab-insights"
          title={t('insights.empty.title')}
          body={t('insights.empty.body')}
        />
      ) : (
        <>
          <Card testID="insights-bottle">
            <CardTitle title={t('insights.bottle.title')} unit={t('insights.bottle.unit')} />
            <BarChart
              bars={insights.bottleBars}
              colour="chartFeed"
              testID="insights-bottle-chart"
            />
            <Text style={s.soft}>{t('insights.total', { value: insights.bottleTotal })}</Text>
          </Card>

          {insights.breastBars && (
            <Card testID="insights-breast">
              <CardTitle title={t('insights.breast.title')} unit={t('insights.breast.unit')} />
              <BarChart
                bars={insights.breastBars}
                colour="chartSleep"
                testID="insights-breast-chart"
              />
              <Text style={s.soft}>{t('insights.total', { value: insights.breastTotal })}</Text>
            </Card>
          )}

          <Card testID="insights-averages">
            <CardTitle title={t('insights.averages.title')} />
            <View style={s.cells}>
              <Figure
                label={t('insights.averages.bottle')}
                value={insights.averageBottle ?? t('insights.none')}
              />
              <Figure
                label={t('insights.averages.interval')}
                value={insights.averageInterval ?? t('insights.none')}
              />
            </View>
          </Card>

          <Card testID="insights-days">
            <CardTitle title={t('insights.days.title')} />
            <View>
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
                total
                testID="insights-day-total"
                cells={[
                  t('insights.days.total'),
                  insights.totals.feeds,
                  insights.totals.wet,
                  insights.totals.dirty,
                  insights.totals.sleep,
                ]}
              />
            </View>
          </Card>
        </>
      )}

      {/* The weight card is its own feature, wired in by app/ (SDD 15). G puts it last. */}
      {weight}
    </ScrollView>
  );
}

/** G averages: a grey cell, the label over the figure. */
function Figure({ label, value }: { label: string; value: string }) {
  return (
    <StatCell
      layout="labelFirst"
      label={label}
      value={value}
      accessibilityLabel={`${label}: ${value}`}
    />
  );
}

/** G trends grid: Day wider, Sleep a little wider, the rest even. */
const COLUMN_FLEX = [1.6, 1, 1, 1, 1.2] as const;

function Row({
  cells,
  header = false,
  total = false,
  testID,
}: {
  cells: (string | number)[];
  header?: boolean;
  total?: boolean;
  testID?: string;
}) {
  const theme = useTheme();
  const s = styles(theme);
  return (
    <View style={[s.row, !header && s.ruled]} testID={testID}>
      {cells.map((cell, i) => (
        <Text
          key={i}
          style={[
            s.cell,
            header ? s.headerCell : total ? theme.type.detailBold : theme.type.detail,
            { flex: COLUMN_FLEX[i] ?? 1 },
          ]}
        >
          {cell}
        </Text>
      ))}
    </View>
  );
}

/** G card heading: the title as text, the unit on the right in soft text. */
function CardTitle({ title, unit }: { title: string; unit?: string }) {
  const theme = useTheme();
  const s = styles(theme);
  return (
    <View style={s.titleRow}>
      <Text accessibilityRole="header" style={[theme.type.chartTitle, s.title]}>
        {title}
      </Text>
      {unit ? <Text style={[theme.type.small, s.unit]}>{unit}</Text> : null}
    </View>
  );
}

const styles = (theme: Theme) =>
  StyleSheet.create({
    content: {
      paddingHorizontal: theme.spacing.screen,
      paddingBottom: theme.size.tabBarClearance,
      gap: theme.spacing.lg,
    },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: theme.spacing.grid,
    },
    title: { flexShrink: 1, color: theme.palette.ink },
    unit: { color: theme.palette.textSoft },
    soft: { ...theme.type.detail, color: theme.palette.textSoft },
    cells: { flexDirection: 'row', gap: theme.spacing.grid },
    row: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs },
    ruled: {
      minHeight: theme.size.tableRow,
      borderTopWidth: theme.size.borderThin,
      borderTopColor: theme.palette.line,
    },
    headerCell: { ...theme.type.small, color: theme.palette.textSoft },
    cell: { color: theme.palette.ink },
  });
