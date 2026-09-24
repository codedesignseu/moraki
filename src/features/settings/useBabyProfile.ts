import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useDevicePref } from '@/db/react';
import { formatDateTime } from '@/domain/time/formatDateTime';
import { localTimeDaysAgo, startOfLocalDay } from '@/domain/time/zoned';
import { dateLocale } from '@/i18n';
import { useAuth } from '@/sync/AuthProvider';
import { HouseholdError, updateBaby } from '@/sync/household';
import { deviceTimeZone } from '@/ui/deviceTimeZone';

const DAY_MS = 86_400_000;
/** Midday, as onboarding uses: a birth date, not a birth time. */
const BORN_HOUR = 12;

/** SDD 4.2's limits, the same ones onboarding and the server check. */
export const BABY_LIMITS = {
  name: 40,
  birthWeightG: { step: 10, min: 500, max: 7000 },
  bornDaysAgo: { step: 1, min: 0, max: 365 },
} as const;

export type BabyProfile = {
  /** Null when this phone has no household yet: there is nothing to correct. */
  canEdit: boolean;
  name: string;
  bornDaysAgo: number;
  /** Null means nobody recorded one, which stays a valid answer. */
  birthWeightG: number | null;
  /** The birth date in words, so a stepper isn't read as a number. */
  bornOn: string;
  busy: boolean;
  problem: 'offline' | 'signed_out' | 'unknown' | null;
  saved: boolean;
  setName: (name: string) => void;
  setBornDaysAgo: (days: number) => void;
  setBirthWeightG: (grams: number | null) => void;
  save: () => Promise<void>;
};

/**
 * Correcting the baby's details (P4-10). They were typed once, in a hurry,
 * by someone who had just had a baby — and the weight chart measures day 0
 * and its reference lines from them, so a typo quietly bends every number on
 * it (SDD 6.4).
 *
 * The change goes to the household's row, and this phone's copy is updated
 * with it so the screens follow at once; the next pull confirms it and
 * carries it to the other phones (P1-F16).
 */
export function useBabyProfile(): BabyProfile {
  const { auth } = useAuth();
  const [household, setHousehold] = useDevicePref('accountHousehold');
  const { i18n } = useTranslation();
  const tz = deviceTimeZone();
  const [openedAt] = useState(Date.now);
  const [name, setName] = useState(household?.babyName ?? '');
  const [bornDaysAgo, setBornDaysAgo] = useState(() =>
    household?.bornAt === undefined
      ? 0
      : Math.max(
          0,
          Math.round(
            (startOfLocalDay(openedAt, tz) - startOfLocalDay(household.bornAt, tz)) / DAY_MS,
          ),
        ),
  );
  const [birthWeightG, setBirthWeightG] = useState<number | null>(household?.birthWeightG ?? null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [problem, setProblem] = useState<BabyProfile['problem']>(null);

  const bornAt = localTimeDaysAgo(openedAt, bornDaysAgo, BORN_HOUR, tz);

  return {
    canEdit: household !== null && name.trim() !== '',
    name,
    bornDaysAgo,
    birthWeightG,
    bornOn: formatDateTime(bornAt, tz, dateLocale(i18n.language)),
    busy,
    saved,
    problem,
    setName: (next: string) => {
      setName(next);
      setSaved(false);
    },
    setBornDaysAgo: (days: number) => {
      setBornDaysAgo(days);
      setSaved(false);
    },
    setBirthWeightG: (grams: number | null) => {
      setBirthWeightG(grams);
      setSaved(false);
    },
    save: async () => {
      if (!auth || !household) {
        setProblem('signed_out');
        return;
      }
      setBusy(true);
      setProblem(null);
      try {
        await updateBaby(auth, household.babyId, { name, bornAt, birthWeightG });
        // This phone's own copy, so the weight chart follows straight away
        // rather than waiting for a pull.
        setHousehold({ ...household, babyName: name.trim(), bornAt, birthWeightG });
        setSaved(true);
      } catch (error) {
        setProblem(error instanceof HouseholdError ? error.reason : 'unknown');
      } finally {
        setBusy(false);
      }
    },
  };
}
