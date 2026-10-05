import { useCallback, useState } from 'react';

import { useResetPhone } from '@/db/react';
import { useAuth } from '@/sync/AuthProvider';
import {
  deleteAccount,
  deleteHousehold,
  ErasureError,
  leaveHousehold,
  type ErasureFailure,
} from '@/sync/erasure';
import { useAccountHousehold } from '@/sync/useAccountHousehold';

import { useCaregivers } from './useCaregivers';

export type ErasureAction = 'leave' | 'deleteHousehold' | 'deleteAccount';

/**
 * Leave a household, delete it, or delete the account (P4-06). Each asks the
 * server first and only then clears the phone, so a failed request leaves
 * everything as it was. Nothing here is undoable; the screen confirms first.
 */
export function useErasure(onDone: () => void) {
  const { auth, state } = useAuth();
  const { household } = useAccountHousehold();
  const caregivers = useCaregivers();
  const resetPhone = useResetPhone();
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<ErasureFailure | null>(null);

  const owner = household?.role === 'owner';
  const others = caregivers.some((person) => !person.you);
  /**
   * D3: the last owner of a household others share picks who takes over,
   * before leaving or deleting the account.
   */
  const needsSuccessor =
    owner && others && !caregivers.some((person) => !person.you && person.role === 'owner');
  const candidates = needsSuccessor ? caregivers.filter((person) => !person.you) : [];
  const [successor, setSuccessor] = useState<string | null>(null);

  const run = useCallback(
    async (action: ErasureAction) => {
      if (!auth || state.status !== 'signedIn') return;
      setBusy(true);
      setProblem(null);
      try {
        const next = needsSuccessor ? successor : null;
        if (action === 'deleteAccount') await deleteAccount(auth, next);
        else if (!household) return;
        else if (action === 'leave') await leaveHousehold(auth, household.householdId, next);
        else await deleteHousehold(auth, household.householdId);
        resetPhone({ forgetAccount: action === 'deleteAccount' });
        onDone();
      } catch (error) {
        setProblem(error instanceof ErasureError ? error.reason : 'unknown');
      } finally {
        setBusy(false);
      }
    },
    [auth, state.status, household, needsSuccessor, successor, resetPhone, onDone],
  );

  return {
    signedIn: state.status === 'signedIn',
    /** Which household actions this account has. */
    canLeave: household != null && (!owner || others),
    canDeleteHousehold: household != null && owner,
    /** Deleting the account also deletes a household nobody else is in. */
    soleMember: household != null && !others,
    babyName: household?.babyName ?? '',
    /** Who may take over, when this account holds the last owner seat (D3). */
    candidates,
    successor,
    setSuccessor,
    /** Leaving or deleting the account waits for a successor to be chosen. */
    ready: (action: ErasureAction) =>
      action === 'deleteHousehold' || !needsSuccessor || successor !== null,
    busy,
    problem,
    run,
  };
}
