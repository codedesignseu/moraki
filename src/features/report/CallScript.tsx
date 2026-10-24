import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { durationParts } from '@/domain/time/durationParts';
import { formatClock } from '@/domain/time/formatClock';
import { formatDuration } from '@/i18n/duration';
import { Card, Page, TextField } from '@/ui/primitives';
import { useTheme, type Theme } from '@/ui/theme';

import { signedGrams } from './reportLabels';
import { useCallScript } from './useCallScript';

const WORRY_MAX = 500;

/**
 * What to say on the phone to a clinician (SDD 6.5, G reports/call-script):
 * one card of figures in the order they ask, then the notes, the questions
 * and a box for the worry. Every line is a figure and its label: nothing
 * here says what any of it means (rule 10). G's Share button is left out (G3).
 */
export function CallScript({ onBack }: { onBack: () => void }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const s = styles(theme);
  const { report, tz, knowsBirth, worry, setWorry, dateTime } = useCallScript();
  const feeds = report.last24h.feeds;
  const duration = (ms: number) => formatDuration(t, durationParts(ms));
  const none = t('report.call.none');
  const ml = t('report.call.ml', { ml: feeds.bottleMl });

  return (
    <Page
      title={t('report.call.title')}
      onBack={onBack}
      backLabel={t('common.back')}
      testID="call-script"
    >
      <Text style={s.intro}>{t('report.call.intro')}</Text>

      <View style={s.figures} testID="call-figures">
        <Group testID="call-age">
          {knowsBirth ? (
            <Line
              label={t('report.call.age')}
              value={t('report.call.days', { count: report.baby.ageDays })}
            />
          ) : (
            <Line label={t('report.call.age')} detail={t('report.call.noBirth')} />
          )}
        </Group>

        <Group testID="call-weight">
          {report.weight.birthGrams !== null && (
            <Line
              label={t('report.call.weight.birth')}
              value={t('report.call.grams', { grams: report.weight.birthGrams })}
            />
          )}
          <Line
            label={t('report.call.weight.latest')}
            value={
              report.weight.latest
                ? t('report.call.weight.latestValue', {
                    grams: report.weight.latest.grams,
                    day: report.weight.latest.day,
                  })
                : t('report.call.weight.none')
            }
          />
          {report.weight.changeG !== null && (
            <Line
              label={t('report.call.weight.change')}
              value={t('report.call.weight.changeValue', {
                grams: signedGrams(report.weight.changeG),
              })}
            />
          )}
        </Group>

        <Group testID="call-feeds">
          <Line
            label={t('report.call.feeds.countDay')}
            value={`${feeds.count}`}
            detail={
              feeds.breastMs > 0
                ? t('report.call.feeds.detailBreast', { ml, breast: duration(feeds.breastMs) })
                : t('report.call.feeds.detail', { ml })
            }
          />
          <Line
            label={t('report.call.feeds.longestGap')}
            value={feeds.longestGapMs === null ? none : duration(feeds.longestGapMs)}
          />
          <Line
            label={t('report.call.feeds.last')}
            value={feeds.lastAt === null ? none : formatClock(feeds.lastAt, tz)}
          />
        </Group>

        <Group testID="call-diapers">
          <Line
            label={t('report.call.diapers.title')}
            value={t('report.call.diapers.value', {
              wet: report.last24h.wet,
              dirty: report.last24h.dirty,
            })}
          />
        </Group>

        <Group testID="call-temperature">
          <Line
            label={t('report.call.temperature.last')}
            value={
              report.lastTemperature
                ? t('report.call.temperature.value', {
                    celsius: report.lastTemperature.celsius.toFixed(1),
                    time: formatClock(report.lastTemperature.at, tz),
                  })
                : none
            }
          />
        </Group>
      </View>

      {(report.notes.length > 0 || report.medications.length > 0) && (
        <Card testID="call-notes">
          <Heading>{t('report.call.notes.title')}</Heading>
          <View style={s.list}>
            {report.notes.map((note) => (
              <Text key={`n${note.at}`} style={s.item} testID={`call-note-${note.at}`}>
                {t('report.call.notes.note', {
                  time: formatClock(note.at, tz),
                  text: note.note ?? t('report.call.temperature.only'),
                })}
              </Text>
            ))}
            {report.medications.map((med) => (
              <Text key={`m${med.at}`} style={s.item} testID={`call-med-${med.at}`}>
                {t(med.dose === null ? 'report.call.notes.med' : 'report.call.notes.medDose', {
                  time: formatClock(med.at, tz),
                  name: med.name,
                  dose: med.dose ?? '',
                })}
              </Text>
            ))}
          </View>
        </Card>
      )}

      {report.appointment && (
        <Card testID="call-questions">
          <Heading>{t('report.call.questions.title')}</Heading>
          <View style={s.list}>
            <Text style={s.soft}>
              {t('report.call.questions.visit', {
                title: report.appointment.title,
                date: dateTime(report.appointment.at),
              })}
            </Text>
            {report.appointment.questions.length > 0 ? (
              report.appointment.questions.map((question, index) => (
                <Text key={`${index}-${question}`} style={s.item} testID={`call-question-${index}`}>
                  {question}
                </Text>
              ))
            ) : (
              <Text style={s.soft}>{t('report.call.questions.none')}</Text>
            )}
          </View>
        </Card>
      )}

      <Card testID="call-worry">
        <TextField
          label={t('report.call.worry.title')}
          placeholder={t('report.call.worry.placeholder')}
          value={worry}
          onChangeText={setWorry}
          multiline
          maxLength={WORRY_MAX}
        />
        <Text style={s.soft}>{t('report.call.worry.hint')}</Text>
      </Card>
    </Page>
  );
}

/** Rows that belong together, so tests and screen readers can find them. */
function Group({ children, testID }: { children: ReactNode; testID: string }) {
  return <View testID={testID}>{children}</View>;
}

function Heading({ children }: { children: string }) {
  const theme = useTheme();
  return (
    <Text accessibilityRole="header" style={[theme.type.detailBold, styles(theme).ink]}>
      {children}
    </Text>
  );
}

/**
 * One line of the script (G value row): what it is on the left, the figure
 * on the right in bold, and what goes with it under the figure.
 */
function Line({ label, value, detail }: { label: string; value?: string; detail?: string }) {
  const theme = useTheme();
  const s = styles(theme);
  const spoken = [value, detail].filter(Boolean).join(', ');
  return (
    <View style={s.line} accessible accessibilityLabel={`${label}: ${spoken}`}>
      <Text style={[theme.type.detail, s.label]}>{label}</Text>
      <View style={s.figure}>
        {value ? <Text style={[theme.type.figureRow, s.value]}>{value}</Text> : null}
        {detail ? <Text style={[theme.type.small, s.detail]}>{detail}</Text> : null}
      </View>
    </View>
  );
}

const styles = (theme: Theme) =>
  StyleSheet.create({
    intro: { ...theme.type.body, color: theme.palette.textSoft },
    // G: one white card, rows 52 high with a hairline under each.
    figures: {
      backgroundColor: theme.palette.card,
      borderRadius: theme.radius.card,
      paddingVertical: theme.spacing.xs,
      paddingHorizontal: theme.spacing.screenEdge,
    },
    line: {
      minHeight: theme.size.valueRow,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: theme.spacing.md,
      paddingVertical: theme.spacing.xs,
      borderBottomWidth: theme.size.borderThin,
      borderBottomColor: theme.palette.line,
    },
    label: { flexShrink: 1, color: theme.palette.textSoft },
    figure: { flexShrink: 1, alignItems: 'flex-end' },
    value: { textAlign: 'right', color: theme.palette.ink },
    detail: { textAlign: 'right', color: theme.palette.textSoft },
    list: { gap: theme.spacing.xs },
    item: { ...theme.type.lead, color: theme.palette.ink },
    soft: { ...theme.type.detail, color: theme.palette.textSoft },
    ink: { color: theme.palette.ink },
  });
