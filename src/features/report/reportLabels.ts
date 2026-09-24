import type { Report } from '@/domain/report/buildReport';
import { formatClock } from '@/domain/time/formatClock';
import { formatElapsed } from '@/domain/time/formatElapsed';

import type { ReportLabels, ReportSection } from './reportHtml';

type Translate = (key: string, values?: Record<string, string | number>) => string;

/** A row is left out when there is nothing to say, rather than reading zero. */
const rows = (entries: ({ label: string; value: string } | null)[]) =>
  entries.filter((entry): entry is { label: string; value: string } => entry !== null);

/**
 * Turns a report into the strings the PDF prints, in SDD 6.5's order. All
 * copy comes from i18n and every figure comes from the report: nothing is
 * computed or judged here.
 */
export function reportLabels(
  report: Report,
  t: Translate,
  tz: string,
  babyName: string,
  dateTime: (at: number) => string,
): ReportLabels {
  const feeds = report.window.feeds;
  const sections: ReportSection[] = [
    {
      key: 'baby',
      heading: t('report.pdf.baby'),
      rows: rows([
        babyName === '' ? null : { label: t('report.pdf.name'), value: babyName },
        report.baby.bornAt === 0
          ? null
          : {
              label: t('report.call.age'),
              value: t('report.call.days', { count: report.baby.ageDays }),
            },
      ]),
    },
    {
      key: 'weight',
      heading: t('report.call.weight.title'),
      rows: rows([
        report.weight.birthGrams === null
          ? null
          : {
              label: t('report.call.weight.birth'),
              value: t('report.call.grams', { grams: report.weight.birthGrams }),
            },
        report.weight.latest === null
          ? null
          : {
              label: t('report.call.weight.latest'),
              value: t('report.call.weight.latestValue', {
                grams: report.weight.latest.grams,
                day: report.weight.latest.day,
              }),
            },
        report.weight.changeG === null || report.weight.changePct === null
          ? null
          : {
              label: t('report.call.weight.change'),
              value: t('report.call.weight.changeValue', {
                grams: report.weight.changeG,
                percent: report.weight.changePct,
              }),
            },
      ]),
    },
    {
      key: 'feeds',
      heading: t('report.pdf.window'),
      rows: rows([
        { label: t('report.call.feeds.count'), value: `${feeds.count}` },
        { label: t('report.call.feeds.ml'), value: t('report.call.ml', { ml: feeds.bottleMl }) },
        feeds.breastMs === 0
          ? null
          : { label: t('report.call.feeds.breast'), value: formatElapsed(feeds.breastMs) },
        feeds.longestGapMs === null
          ? null
          : {
              label: t('report.call.feeds.longestGap'),
              value: formatElapsed(feeds.longestGapMs),
            },
        { label: t('report.call.diapers.wet'), value: `${report.window.wet}` },
        { label: t('report.call.diapers.dirty'), value: `${report.window.dirty}` },
        report.window.sleepMs === 0
          ? null
          : { label: t('report.pdf.sleep'), value: formatElapsed(report.window.sleepMs) },
        report.averageBottleMl === null
          ? null
          : {
              label: t('report.pdf.averageBottle'),
              value: t('report.call.ml', { ml: report.averageBottleMl }),
            },
        report.averageIntervalMs === null
          ? null
          : {
              label: t('report.pdf.averageInterval'),
              value: formatElapsed(report.averageIntervalMs),
            },
      ]),
    },
    {
      key: 'health',
      heading: t('report.call.notes.title'),
      rows: rows([
        report.lastTemperature === null
          ? null
          : {
              label: t('report.call.temperature.last'),
              value: t('report.call.temperature.value', {
                celsius: report.lastTemperature.celsius.toFixed(1),
                time: formatClock(report.lastTemperature.at, tz),
              }),
            },
        ...report.notes.map((note) => ({
          label: dateTime(note.at),
          value: note.note ?? t('report.call.temperature.only'),
        })),
        ...report.medications.map((med) => ({
          label: dateTime(med.at),
          value:
            med.dose === null
              ? med.name
              : t('report.pdf.medDose', { name: med.name, dose: med.dose }),
        })),
      ]),
    },
  ];

  if (report.appointment !== null) {
    sections.push({
      key: 'appointment',
      heading: t('report.call.questions.title'),
      rows: rows([
        {
          label: t('report.pdf.nextVisit'),
          value: t('report.call.questions.visit', {
            title: report.appointment.title,
            date: dateTime(report.appointment.at),
          }),
        },
        ...report.appointment.questions.map((question, index) => ({
          label: t('report.pdf.question', { number: index + 1 }),
          value: question,
        })),
      ]),
    });
  }

  return {
    title: t('report.pdf.title', { name: babyName }),
    subtitle: t('report.pdf.subtitle', {
      range: t(`report.pdf.range.${report.range}`),
      generated: dateTime(report.to),
    }),
    sections,
    // One day of rows says nothing a section hasn't; 3d and 7d get the table.
    table:
      report.days.length < 2
        ? null
        : {
            headers: [
              t('insights.days.day'),
              t('insights.days.feeds'),
              t('report.call.feeds.ml'),
              t('insights.days.wet'),
              t('insights.days.dirty'),
              t('insights.days.sleep'),
            ],
            rows: report.days.map((day) => [
              day.key,
              `${day.feeds}`,
              `${day.ml}`,
              `${day.wet}`,
              `${day.dirty}`,
              formatElapsed(day.sleepMs),
            ]),
          },
    footer: t('report.pdf.footer'),
  };
}
