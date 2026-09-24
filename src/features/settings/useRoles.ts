import { useCallback, useState } from 'react';

import { useCaregiversRepository } from '@/db/react';
import { useAuth } from '@/sync/AuthProvider';
import type { InviteRole } from '@/sync/invites';
import {
  MembershipError,
  removeCaregiver,
  setCaregiverRole,
  type MembershipFailure,
} from '@/sync/memberships';
import { pullCaregivers } from '@/sync/pullCaregivers';
import { useAccountHousehold } from '@/sync/useAccountHousehold';

export type RolesState = {
  /** Only the owner may change what anyone else can do (SDD 4.3). */
  canManage: boolean;
  busy: boolean;
  problem: MembershipFailure | null;
  setRole: (userId: string, role: InviteRole) => Promise<void>;
  remove: (userId: string) => Promise<void>;
};

/**
 * Changing what a caregiver may do, and removing one (P4-07). The pair to
 * P2-F8: a code can be withdrawn before it is used, and this is what is left
 * once someone has already joined.
 *
 * Every change is read back from the server rather than guessed locally, so
 * the list on screen is what the household actually holds — including when
 * the server refused.
 */
export function useRoles(): RolesState {
  const { auth } = useAuth();
  const { household } = useAccountHousehold();
  const caregivers = useCaregiversRepository();
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<MembershipFailure | null>(null);

  const run = useCallback(
    async (change: (householdId: string) => Promise<void>) => {
      if (!auth || !household) {
        setProblem('forbidden');
        return;
      }
      setBusy(true);
      setProblem(null);
      try {
        await change(household.householdId);
        caregivers.replace(
          household.householdId,
          await pullCaregivers(auth, household.householdId),
        );
      } catch (error) {
        setProblem(error instanceof MembershipError ? error.reason : 'unknown');
      } finally {
        setBusy(false);
      }
    },
    [auth, household, caregivers],
  );

  return {
    canManage: household?.role === 'owner',
    busy,
    problem,
    setRole: useCallback(
      (userId: string, role: InviteRole) =>
        run((householdId) => setCaregiverRole(auth!, householdId, userId, role)),
      [run, auth],
    ),
    remove: useCallback(
      (userId: string) => run((householdId) => removeCaregiver(auth!, householdId, userId)),
      [run, auth],
    ),
  };
}
