import { getRandomBytes } from 'expo-crypto';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { newId } from '@/domain/ids';
import { localTimeDaysAgo } from '@/domain/time/zoned';
import { dateLocale } from '@/i18n';
import { useAuth } from '@/sync/AuthProvider';
import { createHousehold, HouseholdError, type Relation } from '@/sync/household';
import { useAccountHousehold } from '@/sync/useAccountHousehold';
import { deviceTimeZone } from '@/ui/deviceTimeZone';

export const LIMITS = {
  displayName: 40,
  babyName: 60,
  bornDaysAgo: { max: 365 },
  birthWeightG: { min: 500, max: 7000 },
} as const;
// A date, not a time: noon keeps it on the same calendar day in nearby timezones.
const BORN_HOUR = 12;

export type SetupProblem =
  'display_name' | 'baby_name' | 'birth_weight' | 'offline' | 'signed_out' | 'unknown';

/**
 * Creates the account's household with its baby (P2-05). Only the server
 * changes: this phone's entries keep their local ids until P2-11 moves them
 * into the household. If the account already has a household, it is
 * remembered and nothing is created.
 */
export function useHouseholdSetup(onDone: () => void) {
  const { auth, state } = useAuth();
  const { household, remember } = useAccountHousehold();
  const { i18n } = useTranslation();
  const [displayName, setDisplayName] = useState('');
  const [relation, setRelation] = useState<Relation | null>(null);
  const [babyName, setBabyName] = useState('');
  const [bornDaysAgo, setBornDaysAgo] = useState(0);
  const [birthWeight, setBirthWeight] = useState('');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<SetupProblem | null>(null);
  const [openedAt] = useState(Date.now);
  const tz = deviceTimeZone();
  const bornAt = localTimeDaysAgo(openedAt, bornDaysAgo, BORN_HOUR, tz);

  // Found one already (another phone, a reinstall): nothing to set up.
  useEffect(() => {
    if (household) onDone();
  }, [household, onDone]);

  async function save() {
    if (!auth || state.status !== 'signedIn') return setProblem('signed_out');
    const weight = birthWeight.trim() === '' ? null : Number(birthWeight);
    if (displayName.trim() === '') return setProblem('display_name');
    if (babyName.trim() === '') return setProblem('baby_name');
    if (
      weight !== null &&
      !(
        Number.isInteger(weight) &&
        weight >= LIMITS.birthWeightG.min &&
        weight <= LIMITS.birthWeightG.max
      )
    ) {
      return setProblem('birth_weight');
    }
    setBusy(true);
    setProblem(null);
    try {
      const created = await createHousehold(
        auth,
        state.user.id,
        { babyName, bornAt, birthWeightG: weight, displayName, relation },
        () => newId(Date.now(), () => getRandomBytes(16)),
      );
      remember(created);
    } catch (error) {
      setProblem(error instanceof HouseholdError ? error.reason : 'unknown');
    } finally {
      setBusy(false);
    }
  }

  return {
    displayName,
    setDisplayName,
    relation,
    toggleRelation: (value: Relation) =>
      setRelation((current) => (current === value ? null : value)),
    babyName,
    setBabyName,
    bornDaysAgo,
    setBornDaysAgo,
    bornOn: new Intl.DateTimeFormat(dateLocale(i18n.language), {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      timeZone: tz,
    }).format(bornAt),
    birthWeight,
    setBirthWeight: (value: string) => setBirthWeight(value.replace(/\D/g, '')),
    busy,
    problem,
    save: () => void save(),
  };
}
