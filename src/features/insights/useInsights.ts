import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { useEvents } from '@/db/react';
import { selectWeekInsights } from '@/domain/insights/weekInsights';
import { durationParts } from '@/domain/time/durationParts';
import { dateLocale } from '@/i18n';
import { formatDuration } from '@/i18n/duration';
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
 * rows, plus week totals and averages. Bottle ml and breastfeeding time stay
 * separate figures, as on home. `empty` when the window holds nothing at all.
 */
export function useInsights() {
  const events = useEvents();
  const now = useNow(INSIGHTS_TICK_MS);
  const tz = deviceTimeZone();
  const { t, i18n } = useTranslation();

  return useMemo(() => {
    const week = selectWeekInsights(events, now, tz);
    const locale = dateLocale(i18n.language);
    const shortDay = new Intl.DateTimeFormat(locale, { weekday: 'short', timeZone: tz });
    const weekday = new Intl.DateTimeFormat(locale, { weekday: 'long', timeZone: tz });
    const days = week.days.map((d) => ({
      ...d,
      label: d.daysAgo === 0 ? t('insights.today') : shortDay.format(d.start),
      name: d.daysAgo === 0 ? t('insights.today') : weekday.format(d.start),
    }));
    const number = new Intl.NumberFormat(locale);
    // G: the bar shows the bare number (the card names the unit); screen
    // readers hear it with its unit.
    const bars = (
      value: (d: (typeof days)[number]) => number,
      spoken: (d: (typeof days)[number]) => string,
    ) =>
      days.map((d): Bar => ({
        key: d.key,
        label: d.label,
        value: value(d),
        valueLabel: number.format(value(d)),
        accessibilityLabel: t('insights.barLabel', { day: d.name, value: spoken(d) }),
        current: d.daysAgo === 0,
      }));
    const ml = (n: number) => t('insights.ml', { value: number.format(n) });
    const long = (ms: number) => formatDuration(t, durationParts(ms));
    const short = (ms: number) => formatDuration(t, durationParts(ms), 'short');
    const minutes = (ms: number) => {
      const p = durationParts(ms);
      return p.hours * 60 + p.minutes;
    };

    return {
      empty: week.empty,
      bottleBars: bars(
        (d) => d.ml,
        (d) => ml(d.ml),
      ),
      bottleTotal: ml(week.totals.ml),
      // Only for families who breastfeed: a week with none shows no chart.
      breastBars:
        week.totals.breastMs > 0
          ? bars(
              (d) => minutes(d.breastMs),
              (d) => long(d.breastMs),
            )
          : null,
      breastTotal: long(week.totals.breastMs),
      averageBottle: week.averageBottleMl === null ? null : ml(Math.round(week.averageBottleMl)),
      averageInterval: week.averageIntervalMs === null ? null : short(week.averageIntervalMs),
      rows: days.map((d): InsightRow => ({
        key: d.key,
        day: d.label,
        feeds: d.feeds,
        wet: d.wet,
        dirty: d.dirty,
        sleep: short(d.sleepMs),
      })),
      totals: { ...week.totals, sleep: short(week.totals.sleepMs) },
    };
  }, [events, now, tz, t, i18n.language]);
}
