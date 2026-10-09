import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import type { ReportRange } from '@/domain/report/buildReport';
import { Button, Card } from '@/ui/primitives';
import { useTheme, type Theme } from '@/ui/theme';

import { useReport } from './useReport';

/**
 * What the PDF will say, on screen, with the button that makes it. The
 * preview and the PDF read the same labels, so nothing can appear in one and
 * not the other.
 */
export function ReportPreview({ range }: { range: ReportRange }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const s = styles(theme);
  const { labels, problem, sharing, share } = useReport(range);

  return (
    <ScrollView contentContainerStyle={s.content}>
      <Card testID="report-header">
        <Text style={theme.type.heading}>{labels.title}</Text>
        <Text style={s.muted}>{labels.subtitle}</Text>
      </Card>

      {labels.sections
        .filter((section) => section.rows.length > 0)
        .map((section) => (
          <Card key={section.key} testID={`report-${section.key}`}>
            <Text style={theme.type.tileTitle}>{section.heading}</Text>
            {section.rows.map((row, i) => (
              <View
                key={`${row.label}-${i}`}
                style={s.row}
                accessible
                accessibilityLabel={`${row.label}: ${row.value}`}
              >
                <Text style={s.label}>{row.label}</Text>
                <Text style={theme.text.body}>{row.value}</Text>
              </View>
            ))}
          </Card>
        ))}

      {labels.table && (
        <Card testID="report-days">
          <View style={s.tableRow}>
            {labels.table.headers.map((header) => (
              <Text key={header} style={s.headerCell}>
                {header}
              </Text>
            ))}
          </View>
          {labels.table.rows.map((cells) => (
            <View key={cells[0]} style={s.tableRow} testID={`report-day-${cells[0]}`}>
              {cells.map((cell, i) => (
                <Text key={i} style={i === 0 ? s.firstCell : s.cell}>
                  {cell}
                </Text>
              ))}
            </View>
          ))}
        </Card>
      )}

      {problem && (
        <Text style={s.problem} accessibilityRole="alert" testID="report-problem">
          {t(`report.share.${problem}`)}
        </Text>
      )}

      <Button
        label={t(sharing ? 'report.share.working' : 'report.share.action')}
        onPress={() => void share()}
        disabled={sharing}
      />
      <Text style={s.muted}>{labels.footer}</Text>
    </ScrollView>
  );
}

const styles = (theme: Theme) =>
  StyleSheet.create({
    content: { padding: theme.spacing.screen, gap: theme.spacing.md },
    muted: { ...theme.text.label, color: theme.colors.textMuted },
    row: { flexDirection: 'row', justifyContent: 'space-between', gap: theme.spacing.md },
    label: { ...theme.text.body, color: theme.colors.textMuted, flexShrink: 1 },
    problem: { ...theme.text.body, color: theme.colors.invalid },
    tableRow: { flexDirection: 'row', gap: theme.spacing.sm },
    headerCell: { ...theme.text.label, color: theme.colors.textMuted, flex: 1, textAlign: 'right' },
    firstCell: { ...theme.text.body, flex: 2 },
    cell: { ...theme.text.body, flex: 1, textAlign: 'right' },
  });
