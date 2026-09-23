import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { formatClock } from '@/domain/time/formatClock';
import { formatElapsed } from '@/domain/time/formatElapsed';
import { Card, TextField } from '@/ui/primitives';
import { useTheme, type Theme } from '@/ui/theme';

import { useCallScript } from './useCallScript';

const WORRY_MAX = 500;

/**
 * What to say on the phone to a clinician (SDD 6.5), in the order they ask,
 * in type big enough to read at arm's length while holding a baby. Every line
 * is a figure and its label: nothing here says what any of it means (rule 10).
 */
export function CallScript() {
  const { t } = useTranslation();
  const theme = useTheme();
  const s = styles(theme);
  const { report, tz, knowsBirth, worry, setWorry } = useCallScript();
  const feeds = report.last24h.feeds;

  return (
    <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
      <Card testID="call-age">
        {knowsBirth ? (
          <Line
            label={t('report.call.age')}
            value={t('report.call.days', { count: report.baby.ageDays })}
          />
        ) : (
          <Text style={s.muted}>{t('report.call.noBirth')}</Text>
        )}
      </Card>

      <Card testID="call-weight">
        <Text style={s.section}>{t('report.call.weight.title')}</Text>
        {report.weight.birthGrams !== null && (
          <Line
            label={t('report.call.weight.birth')}
            value={t('report.call.grams', { grams: report.weight.birthGrams })}
          />
        )}
        {report.weight.latest ? (
          <>
            <Line
              label={t('report.call.weight.latest')}
              value={t('report.call.weight.latestValue', {
                grams: report.weight.latest.grams,
                day: report.weight.latest.day,
              })}
            />
            {report.weight.changeG !== null && report.weight.changePct !== null && (
              <Line
                label={t('report.call.weight.change')}
                value={t('report.call.weight.changeValue', {
                  grams: report.weight.changeG,
                  percent: report.weight.changePct,
                })}
              />
            )}
          </>
        ) : (
          <Text style={s.muted}>{t('report.call.weight.none')}</Text>
        )}
      </Card>

      <Card testID="call-feeds">
        <Text style={s.section}>{t('report.call.feeds.title')}</Text>
        <Line label={t('report.call.feeds.count')} value={`${feeds.count}`} />
        <Line
          label={t('report.call.feeds.ml')}
          value={t('report.call.ml', { ml: feeds.bottleMl })}
        />
        {feeds.breastMs > 0 && (
          <Line label={t('report.call.feeds.breast')} value={formatElapsed(feeds.breastMs)} />
        )}
        <Line
          label={t('report.call.feeds.longestGap')}
          value={
            feeds.longestGapMs === null ? t('report.call.none') : formatElapsed(feeds.longestGapMs)
          }
        />
        <Line
          label={t('report.call.feeds.last')}
          value={feeds.lastAt === null ? t('report.call.none') : formatClock(feeds.lastAt, tz)}
        />
      </Card>

      <Card testID="call-diapers">
        <Text style={s.section}>{t('report.call.diapers.title')}</Text>
        <Line label={t('report.call.diapers.wet')} value={`${report.last24h.wet}`} />
        <Line label={t('report.call.diapers.dirty')} value={`${report.last24h.dirty}`} />
      </Card>

      <Card testID="call-temperature">
        <Text style={s.section}>{t('report.call.temperature.title')}</Text>
        {report.lastTemperature ? (
          <Line
            label={t('report.call.temperature.last')}
            value={t('report.call.temperature.value', {
              celsius: report.lastTemperature.celsius.toFixed(1),
              time: formatClock(report.lastTemperature.at, tz),
            })}
          />
        ) : (
          <Text style={s.muted}>{t('report.call.none')}</Text>
        )}
      </Card>

      {(report.notes.length > 0 || report.medications.length > 0) && (
        <Card testID="call-notes">
          <Text style={s.section}>{t('report.call.notes.title')}</Text>
          {report.notes.map((note) => (
            <Text key={`n${note.at}`} style={theme.text.body} testID={`call-note-${note.at}`}>
              {t('report.call.notes.note', {
                time: formatClock(note.at, tz),
                text: note.note ?? t('report.call.temperature.only'),
              })}
            </Text>
          ))}
          {report.medications.map((med) => (
            <Text key={`m${med.at}`} style={theme.text.body} testID={`call-med-${med.at}`}>
              {t(med.dose === null ? 'report.call.notes.med' : 'report.call.notes.medDose', {
                time: formatClock(med.at, tz),
                name: med.name,
                dose: med.dose ?? '',
              })}
            </Text>
          ))}
        </Card>
      )}

      <Card testID="call-worry">
        <Text style={s.section}>{t('report.call.worry.title')}</Text>
        <TextField
          label={t('report.call.worry.label')}
          value={worry}
          onChangeText={setWorry}
          multiline
          maxLength={WORRY_MAX}
        />
        <Text style={s.muted}>{t('report.call.worry.hint')}</Text>
      </Card>
    </ScrollView>
  );
}

/** One line of the script: what to say, and the figure to say it with. */
function Line({ label, value }: { label: string; value: string }) {
  const theme = useTheme();
  const s = styles(theme);
  return (
    <View style={s.line} accessible accessibilityLabel={`${label}: ${value}`}>
      <Text style={s.label}>{label}</Text>
      <Text style={s.value}>{value}</Text>
    </View>
  );
}

const styles = (theme: Theme) =>
  StyleSheet.create({
    content: { padding: theme.spacing.lg, gap: theme.spacing.md },
    // Read at arm's length: the figure is the biggest thing on the line.
    line: { gap: theme.spacing.xs },
    label: { ...theme.text.body, color: theme.colors.textMuted },
    value: theme.text.title,
    section: theme.text.heading,
    muted: { ...theme.text.body, color: theme.colors.textMuted },
  });
