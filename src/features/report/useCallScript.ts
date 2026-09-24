import { useMemo, useState } from 'react';

import { useTranslation } from 'react-i18next';

import { useDevicePref, useEvents } from '@/db/react';
import { buildReport, type Report } from '@/domain/report/buildReport';
import { formatDateTime } from '@/domain/time/formatDateTime';
import { dateLocale } from '@/i18n';
import { deviceTimeZone } from '@/ui/deviceTimeZone';
import { useNow } from '@/ui/useNow';

/** The script is read while talking, so its figures refresh every minute. */
const TICK_MS = 60_000;

/** Used only when this phone has no baby details yet. */
const UNKNOWN_BABY = { name: '', bornAt: 0, birthWeightG: null };

export type CallScript = {
  report: Report;
  tz: string;
  /** Whether this phone knows the baby's birth date, so days mean anything. */
  knowsBirth: boolean;
  /** Typed by the parent while they talk. Never stored (SDD 6.5 item 7). */
  worry: string;
  setWorry: (text: string) => void;
  /** A moment in words, for the appointment the questions belong to. */
  dateTime: (at: number) => string;
};

/**
 * The call script's state (SDD 6.5): the report built from what this phone
 * has, and a box for what the parent wants to raise. The box is state only —
 * nothing types it into the database.
 */
export function useCallScript(): CallScript {
  const events = useEvents();
  const [household] = useDevicePref('accountHousehold');
  const now = useNow(TICK_MS);
  const tz = deviceTimeZone();
  const [worry, setWorry] = useState('');
  const { i18n } = useTranslation();
  const locale = dateLocale(i18n.language);

  const bornAt = household?.bornAt;
  const baby = useMemo(
    () =>
      bornAt === undefined
        ? UNKNOWN_BABY
        : {
            name: household?.babyName ?? '',
            bornAt,
            birthWeightG: household?.birthWeightG ?? null,
          },
    [bornAt, household?.babyName, household?.birthWeightG],
  );

  return {
    report: useMemo(() => buildReport(events, baby, '24h', now, tz), [events, baby, now, tz]),
    tz,
    knowsBirth: bornAt !== undefined,
    worry,
    setWorry,
    dateTime: (at: number) => formatDateTime(at, tz, locale),
  };
}
