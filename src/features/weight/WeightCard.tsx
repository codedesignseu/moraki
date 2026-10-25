import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { dateLocale } from '@/i18n';
import { Button, Card, IconCircle, Legend, PointChart } from '@/ui/primitives';
import { useTheme, type Theme } from '@/ui/theme';

import { useWeightLog } from './useWeightLog';

/**
 * Weight over time (SDD 6.4, G tabs/trends). The copy says what was weighed
 * and when; the chart has the points and nothing to read them against — no
 * reference lines, no marked days (P0.7). Nothing here judges a number
 * (rule 10). The change since birth is plain arithmetic: a signed figure in
 * ink, read out as a plain sentence.
 */
export function WeightCard({ onAddWeight }: { onAddWeight?: () => void }) {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const s = styles(theme);
  const view = useWeightLog();
  const number = new Intl.NumberFormat(dateLocale(i18n.language));
  const grams = (value: number) => t('insights.weight.grams', { grams: number.format(value) });
  const change = view.changeG;
  const direction = change === null ? null : change === 0 ? 'same' : change > 0 ? 'up' : 'down';

  return (
    <Card testID="insights-weight">
      <View style={s.titleRow}>
        <IconCircle icon="weight" tone="chip" />
        <Text accessibilityRole="header" style={[theme.type.cardTitle, s.ink]}>
          {t('insights.weight.title')}
        </Text>
      </View>

      {(view.birthGrams !== null || view.latest) && (
        <View style={s.figures}>
          {view.birthGrams !== null && (
            <Figure label={t('insights.weight.birth')} value={grams(view.birthGrams)} />
          )}
          {view.latest && (
            <Figure label={t('insights.weight.latest')} value={grams(view.latest.grams)} />
          )}
          {change !== null && direction !== null && (
            <Figure
              label={t('insights.weight.since')}
              value={t(`insights.weight.delta.${direction}`, {
                grams: number.format(Math.abs(change)),
              })}
              spoken={t(`insights.weight.change.${direction}`, { grams: Math.abs(change) })}
            />
          )}
        </View>
      )}

      {view.hasChart && (
        <>
          <PointChart
            testID="weight-chart"
            xRange={view.days}
            points={view.points.map((p) => ({
              key: `${p.at}`,
              x: p.day,
              y: p.grams,
              hollow: p.source === 'home',
              accessibilityLabel: t('insights.weight.point', { day: p.day, grams: p.grams }),
            }))}
          />
          <Legend
            items={[
              { label: t('insights.weight.source.clinic') },
              { label: t('insights.weight.source.home'), shape: 'hollow' },
            ]}
          />
        </>
      )}

      {view.rows.length > 0 ? (
        <View>
          {view.rows.map((row) => {
            const when = t('insights.weight.entry', {
              on: row.on,
              source: t(`insights.weight.source.${row.source}`),
            });
            return (
              <View
                key={row.key}
                style={s.row}
                testID={`weight-row-${row.key}`}
                accessible
                accessibilityLabel={`${when}, ${grams(row.grams)}`}
              >
                <Text style={[theme.type.detail, s.soft]}>{when}</Text>
                <Text style={[theme.type.figureRow, s.ink]}>{grams(row.grams)}</Text>
              </View>
            );
          })}
        </View>
      ) : (
        <Text style={[theme.type.rowLabel, s.soft]}>{t('insights.weight.empty')}</Text>
      )}

      {onAddWeight && (
        <Button label={t('insights.weight.add')} variant="secondary" onPress={onAddWeight} />
      )}
    </Card>
  );
}

/** G weight figure: a soft label over the number. */
function Figure({ label, value, spoken }: { label: string; value: string; spoken?: string }) {
  const theme = useTheme();
  const s = styles(theme);
  return (
    <View style={s.figure} accessible accessibilityLabel={spoken ?? `${label}, ${value}`}>
      <Text style={[theme.type.small, s.soft]}>{label}</Text>
      <Text style={[theme.type.figure, s.ink]}>{value}</Text>
    </View>
  );
}

const styles = (theme: Theme) =>
  StyleSheet.create({
    ink: { color: theme.palette.ink },
    soft: { color: theme.palette.textSoft },
    titleRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.grid },
    figures: { flexDirection: 'row', gap: theme.spacing.sm },
    figure: { flex: 1 },
    row: {
      minHeight: theme.size.weightRow,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: theme.spacing.md,
      borderBottomWidth: theme.size.borderThin,
      borderBottomColor: theme.palette.line,
    },
  });
