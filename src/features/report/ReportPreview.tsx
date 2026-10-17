import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import type { ReportRange } from '@/domain/report/buildReport';
import { Button, Card, InlineError, Page, StatCell } from '@/ui/primitives';
import { useTheme, type Theme } from '@/ui/theme';

import type { ReportStat } from './reportHtml';
import { useReport } from './useReport';

/** G report grid: Day wider, Sleep a little wider, the rest even. */
const COLUMN_FLEX = [1.6, 1, 1.3, 1, 1, 1.3] as const;

/**
 * What the PDF will say, on screen, with the button that makes it (G
 * reports/report): the window's counts as tiles, the app's section cards and
 * the days grid. The preview and the PDF read the same labels, so nothing can
 * appear in one and not the other.
 */
export function ReportPreview({ range, onBack }: { range: ReportRange; onBack: () => void }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const s = styles(theme);
  const { labels, problem, sharing, share } = useReport(range);

  return (
    <Page
      title={t('report.preview.title')}
      onBack={onBack}
      backLabel={t('common.back')}
      footer={
        <>
          {problem && (
            <InlineError
              prefix={t('common.error')}
              message={t(`report.share.${problem}`)}
              testID="report-problem"
            />
          )}
          <Button
            label={t(sharing ? 'report.share.working' : 'report.share.action')}
            onPress={() => void share()}
            disabled={sharing}
            busy={sharing}
          />
          <Text style={[theme.type.small, s.soft]}>{labels.footer}</Text>
        </>
      }
    >
      <View testID="report-header">
        <Text style={[theme.type.figureRow, s.ink]}>{labels.title}</Text>
        <Text style={[theme.type.rowLabel, s.soft]}>{labels.subtitle}</Text>
      </View>

      <View style={s.tiles} testID="report-stats">
        {pairs(labels.stats).map((pair) => (
          <View key={pair.map((stat) => stat.label).join()} style={s.tileRow}>
            {pair.map((stat) => (
              <StatCell
                key={stat.label}
                tone="card"
                layout="labelFirst"
                label={stat.label}
                value={stat.value}
                accessibilityLabel={`${stat.label}: ${stat.value}`}
              />
            ))}
            {pair.length === 1 ? <View style={s.spacer} /> : null}
          </View>
        ))}
      </View>

      {labels.sections
        .filter((section) => section.rows.length > 0)
        .map((section) => (
          <Card key={section.key} testID={`report-${section.key}`}>
            <Text accessibilityRole="header" style={[theme.type.chartTitle, s.ink]}>
              {section.heading}
            </Text>
            <View>
              {section.rows.map((row, i) => (
                <View
                  key={`${row.label}-${i}`}
                  style={[s.row, i > 0 && s.ruled]}
                  accessible
                  accessibilityLabel={`${row.label}: ${row.value}`}
                >
                  <Text style={[theme.type.detail, s.label]}>{row.label}</Text>
                  <Text style={[theme.type.figureRow, s.value]}>{row.value}</Text>
                </View>
              ))}
            </View>
          </Card>
        ))}

      {labels.table && (
        <Card testID="report-days">
          <View>
            <View style={s.gridRow}>
              {labels.table.headers.map((header, i) => (
                <Text
                  key={header}
                  style={[theme.type.small, s.soft, { flex: COLUMN_FLEX[i] ?? 1 }]}
                >
                  {header}
                </Text>
              ))}
            </View>
            {labels.table.rows.map((cells) => (
              <View
                key={cells[0]}
                style={[s.gridRow, s.ruled, s.tableRow]}
                testID={`report-day-${cells[0]}`}
              >
                {cells.map((cell, i) => (
                  <Text key={i} style={[theme.type.detail, s.ink, { flex: COLUMN_FLEX[i] ?? 1 }]}>
                    {cell}
                  </Text>
                ))}
              </View>
            ))}
          </View>
        </Card>
      )}
    </Page>
  );
}

/** G draws the tiles two to a row. */
function pairs(stats: ReportStat[]): ReportStat[][] {
  const out: ReportStat[][] = [];
  for (let i = 0; i < stats.length; i += 2) out.push(stats.slice(i, i + 2));
  return out;
}

const styles = (theme: Theme) =>
  StyleSheet.create({
    ink: { color: theme.palette.ink },
    soft: { color: theme.palette.textSoft },
    tiles: { gap: theme.spacing.grid },
    tileRow: { flexDirection: 'row', gap: theme.spacing.grid },
    spacer: { flex: 1 },
    row: {
      minHeight: theme.size.valueRow,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: theme.spacing.md,
      paddingVertical: theme.spacing.xs,
    },
    ruled: { borderTopWidth: theme.size.borderThin, borderTopColor: theme.palette.line },
    label: { flexShrink: 1, color: theme.palette.textSoft },
    value: { flexShrink: 1, textAlign: 'right', color: theme.palette.ink },
    gridRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs },
    tableRow: { minHeight: theme.size.tableRow },
  });
