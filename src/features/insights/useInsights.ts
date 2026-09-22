import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { useEvents } from '@/db/react';
import { selectWeekInsights } from '@/domain/insights/weekInsights';
import { formatElapsed } from '@/domain/time/formatElapsed';
import { dateLocale } from '@/i18n';
import { deviceTimeZone } from '@/ui/deviceTimeZone';
import type { Bar } from '@/ui/primitives';
import { useNow } from '@/ui/useNow';

// Keeps a running sleep and the midnight rollover current; a minute is plenty.
const INSIGHTS_TICK_MS = 60_000;

export type InsightRow = {
  key: string;
  day: string;
  feeds: number;
  wet: number;
  dirty: number;
  sleep: string;
};

/**
 * The insights view model (SDD 15.4): the last 7 local days as chart bars and
 * rows, plus week totals and averages. Bottle mL and breastfeeding time stay
 * separate figures, as on home.
 */
export function useInsights() {
  const events = useEvents();
  const now = useNow(INSIGHTS_TICK_MS);
  const tz = deviceTimeZone();
  const { t, i18n } = useTranslation();

  return useMemo(() => {
    const week = selectWeekInsights(events, now, tz);
    const locale = dateLocale(i18n.language);
    const short = new Intl.DateTimeFormat(locale, { weekday: 'short', timeZone: tz });
    const long = new Intl.DateTimeFormat(locale, { weekday: 'long', timeZone: tz });
    const days = week.days.map((d) => ({
      ...d,
      label: d.daysAgo === 0 ? t('insights.today') : short.format(d.start),
      name: d.daysAgo === 0 ? t('insights.today') : long.format(d.start),
    }));
    const bars = (value: (d: (typeof days)[number]) => number, format: (n: number) => string) =>
      days.map((d): Bar => ({
        key: d.key,
        label: d.label,
        value: value(d),
        valueLabel: format(value(d)),
        accessibilityLabel: t('insights.barLabel', { day: d.name, value: format(value(d)) }),
        current: d.daysAgo === 0,
      }));
    const ml = (n: number) => t('insights.ml', { value: n });

    return {
      bottleBars: bars((d) => d.ml, ml),
      bottleTotal: ml(week.totals.ml),
      // Only for families who breastfeed: a week with none shows no chart.
      breastBars: week.totals.breastMs > 0 ? bars((d) => d.breastMs, formatElapsed) : null,
      breastTotal: formatElapsed(week.totals.breastMs),
      averageBottle: week.averageBottleMl === null ? null : ml(Math.round(week.averageBottleMl)),
      averageInterval:
        week.averageIntervalMs === null ? null : formatElapsed(week.averageIntervalMs),
      rows: days.map((d): InsightRow => ({
        key: d.key,
        day: d.label,
        feeds: d.feeds,
        wet: d.wet,
        dirty: d.dirty,
        sleep: formatElapsed(d.sleepMs),
      })),
      totals: { ...week.totals, sleep: formatElapsed(week.totals.sleepMs) },
    };
  }, [events, now, tz, t, i18n.language]);
}
