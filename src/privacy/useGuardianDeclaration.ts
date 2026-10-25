import { useCallback, useState, useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';

import { useCaregiversRepository, useDevicePref } from '@/db/react';
import { consentLocale, guardianStatus } from '@/domain/consent/consent';
import { useAuth } from '@/sync/AuthProvider';
import { declareGuardian } from '@/sync/guardian';
import { useAccountHousehold } from '@/sync/useAccountHousehold';

export type GuardianProblem = 'unticked' | 'offline' | 'unknown';

/**
 * The guardian declaration for the signed-in account's household (P0.1).
 * Only a member who has made it can own the household or take it over.
 *
 * - An owner from before the declaration existed is a guardian on the
 *   server without having made it on record: `needed` once the server says
 *   so, and their entries wait (see SyncProvider).
 * - Any other member who hasn't made it can, from Settings: `needed` too.
 */
export function useGuardianDeclaration() {
  const { auth, state } = useAuth();
  const { household } = useAccountHousehold();
  const caregivers = useCaregiversRepository();
  const changes = useSyncExternalStore(caregivers.subscribe, caregivers.version);
  const [record, setRecord] = useDevicePref('guardianDeclaration');
  const { i18n } = useTranslation();
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<GuardianProblem | null>(null);
  const userId = state.status === 'signedIn' ? state.user.id : null;
  const householdId = household?.householdId ?? null;
  const status = guardianStatus(record, userId, householdId);
  const owner = household?.role === 'owner';
  // `changes` re-reads the mirror after a pull brings new membership rows.
  const me = changes >= 0 ? caregivers.list().find((row) => row.userId === userId) : undefined;

  const declare = useCallback(
    async (ticked: boolean): Promise<boolean> => {
      if (!ticked) {
        setProblem('unticked');
        return false;
      }
      if (!auth || !userId || !householdId) {
        setProblem('unknown');
        return false;
      }
      setBusy(true);
      setProblem(null);
      try {
        await declareGuardian(auth, householdId, consentLocale(i18n.language));
        setRecord({ userId, householdId, onRecord: true });
        return true;
      } catch (error) {
        setProblem(error instanceof Error && error.message === 'offline' ? 'offline' : 'unknown');
        return false;
      } finally {
        setBusy(false);
      }
    },
    [auth, userId, householdId, i18n.language, setRecord],
  );

  return {
    owner,
    status,
    /** Whether to ask: an owner the server has no declaration from, or a member who hasn't made it. */
    needed: owner
      ? status === 'missing'
      : me !== undefined && !me.isGuardian && status !== 'on_record',
    /** Stores what the server said, for this account and household. */
    remember: useCallback(
      (onRecord: boolean) => userId && householdId && setRecord({ userId, householdId, onRecord }),
      [userId, householdId, setRecord],
    ),
    busy,
    problem,
    declare,
  };
}
