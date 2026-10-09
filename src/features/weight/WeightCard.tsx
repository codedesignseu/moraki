import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { Button, Card, Icon, PointChart } from '@/ui/primitives';
import { useTheme, type Theme } from '@/ui/theme';

import { useWeightLog } from './useWeightLog';

/**
 * Weight over time against the birth weight (SDD 6.4). The copy says what was
 * weighed and when, and the only sentence about it points at the pediatrician:
 * nothing here judges a number (rule 10).
 */
export function WeightCard({ onAddWeight }: { onAddWeight?: () => void }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const s = styles(theme);
  const view = useWeightLog();

  return (
    <Card testID="insights-weight">
      <View style={s.titleRow}>
        <Icon name="weight" />
        <Text style={[theme.type.tileTitle, s.title]}>{t('insights.weight.title')}</Text>
      </View>
      {view.birthGrams !== null && (
        <Text style={s.muted}>{t('insights.weight.birth', { grams: view.birthGrams })}</Text>
      )}

      {view.hasChart && (
        <PointChart
          testID="weight-chart"
          xRange={view.days}
          points={view.points.map((p) => ({
            key: `${p.at}`,
            x: p.day,
            y: p.grams,
            accessibilityLabel: t('insights.weight.point', { day: p.day, grams: p.grams }),
          }))}
          lines={view.references.map((r) => ({
            key: r.key,
            y: r.grams,
            label: t('insights.weight.line', { percent: r.percent }),
          }))}
          marks={view.markerDays.map((day) => ({
            key: `day-${day}`,
            x: day,
            label: t('insights.weight.mark', { day }),
          }))}
        />
      )}

      {view.latest ? (
        <>
          <Text style={theme.text.body}>
            {t('insights.weight.latest', { grams: view.latest.grams, day: view.latest.day })}
          </Text>
          {view.changeG !== null && (
            <Text style={theme.text.body}>
              {view.changeG === 0
                ? t('insights.weight.change.same')
                : t(
                    view.changeG > 0 ? 'insights.weight.change.up' : 'insights.weight.change.down',
                    {
                      grams: Math.abs(view.changeG),
                    },
                  )}
            </Text>
          )}
          <View style={s.rows}>
            {view.rows.map((row) => (
              <Text key={row.key} style={theme.text.body} testID={`weight-row-${row.key}`}>
                {row.day === null
                  ? t(`insights.weight.dated.${row.source}`, { on: row.on, grams: row.grams })
                  : t(`insights.weight.row.${row.source}`, { day: row.day, grams: row.grams })}
              </Text>
            ))}
          </View>
        </>
      ) : (
        <Text style={s.muted}>{t('insights.weight.empty')}</Text>
      )}

      <Text style={s.muted}>{t('insights.weight.note')}</Text>
      {onAddWeight && (
        <Button label={t('insights.weight.add')} variant="secondary" onPress={onAddWeight} />
      )}
    </Card>
  );
}

const styles = (theme: Theme) =>
  StyleSheet.create({
    muted: { ...theme.type.detail, color: theme.palette.textSoft },
    titleRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
    title: { flex: 1 },
    rows: { gap: theme.spacing.xs },
  });
