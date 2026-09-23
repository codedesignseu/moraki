import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { useDevicePref, useEvents } from '@/db/react';
import { formatDateTime } from '@/domain/time/formatDateTime';
import { selectWeightView, type WeightPoint } from '@/domain/weight/weightSeries';
import { dateLocale } from '@/i18n';
import { deviceTimeZone } from '@/ui/deviceTimeZone';

export type WeightLogRow = {
  key: string;
  /** Null when this phone has no birth date to count days from. */
  day: number | null;
  /** When it was weighed, for a row that has no day to show. */
  on: string;
  grams: number;
  source: 'home' | 'clinic';
};

export type WeightLogView = {
  /** Newest first, the way the log reads. */
  rows: WeightLogRow[];
  points: WeightPoint[];
  references: { key: string; grams: number; percent: number }[];
  markerDays: number[];
  /** The x axis: day 0 to the later of day 14 and the last weighing. */
  days: { min: number; max: number };
  birthGrams: number | null;
  latest: WeightPoint | null;
  changeG: number | null;
  /** Without a birth date there is no day to plot against, so no chart. */
  hasChart: boolean;
};

const MIN_DAYS = 14;

/**
 * The weight card's view model. Days come from the baby's birth date, which
 * this phone holds with the household record; a phone that has never had one
 * shows the log without the chart rather than inventing a day 0.
 */
export function useWeightLog(): WeightLogView {
  const events = useEvents();
  const { i18n } = useTranslation();
  // This phone's own record of the household (rule 1: read SQLite, never wait
  // on the network). Read straight from the pref rather than through
  // useAccountHousehold, so the card still draws while signed out.
  const [household] = useDevicePref('accountHousehold');
  const tz = deviceTimeZone();
  const locale = dateLocale(i18n.language);
  const bornAt = household?.bornAt ?? null;
  const birthGrams = household?.birthWeightG ?? null;

  return useMemo(() => {
    const view = selectWeightView(events, { bornAt: bornAt ?? 0, birthGrams }, tz);
    const lastDay = view.points.length > 0 ? (view.points[view.points.length - 1]?.day ?? 0) : 0;
    return {
      rows: [...view.points].reverse().map((p) => ({
        key: `${p.at}`,
        day: bornAt === null ? null : p.day,
        on: formatDateTime(p.at, tz, locale),
        grams: p.grams,
        source: p.source,
      })),
      points: view.points,
      references: view.references.map((r) => ({
        key: `pct-${r.pctOfBirth}`,
        grams: r.grams,
        percent: r.pctOfBirth,
      })),
      markerDays: view.markerDays,
      days: { min: 0, max: Math.max(MIN_DAYS, lastDay) },
      birthGrams,
      latest: view.latest,
      changeG: view.changeG,
      hasChart: bornAt !== null && view.points.length > 0,
    };
  }, [events, bornAt, birthGrams, tz, locale]);
}
