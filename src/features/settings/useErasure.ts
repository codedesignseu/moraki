import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform } from 'react-native';

import { useResetPhone } from '@/db/react';
import { consentLocale } from '@/domain/consent/consent';
import { useAuth } from '@/sync/AuthProvider';
import {
  deleteAccount,
  deleteHousehold,
  ErasureError,
  leaveHousehold,
  revokeAppleTokens,
  type ErasureFailure,
} from '@/sync/erasure';
import { useAccountHousehold } from '@/sync/useAccountHousehold';

import { confirmWithApple } from './appleConfirm';
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
  const { i18n } = useTranslation();
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
  // P0.1: only someone who has declared they are a parent or guardian.
  const candidates = needsSuccessor
    ? caregivers.filter((person) => !person.you && person.isGuardian)
    : [];
  /** Nobody can take over, so the household can only be deleted (P0.1). */
  const noGuardian = needsSuccessor && candidates.length === 0;
  const [successor, setSuccessor] = useState<string | null>(null);

  const run = useCallback(
    async (action: ErasureAction) => {
      if (!auth || state.status !== 'signedIn') return;
      setBusy(true);
      setProblem(null);
      try {
        const next = needsSuccessor ? successor : null;
        if (action === 'deleteAccount') {
          // App Store 5.1.1(v): an Apple-linked account's Apple tokens are
          // revoked first. Only iOS has Apple's native sheet; elsewhere the
          // account is deleted without it (see docs/10-release-runbook.md).
          if (Platform.OS === 'ios' && (await auth.providers()).includes('apple')) {
            const code = await confirmWithApple();
            if (code === null) throw new ErasureError('apple_cancelled');
            await revokeAppleTokens(auth, code);
          }
          await deleteAccount(auth, next);
        } else if (!household) return;
        else if (action === 'leave')
          await leaveHousehold(auth, household.householdId, next, consentLocale(i18n.language));
        else await deleteHousehold(auth, household.householdId);
        resetPhone({ forgetAccount: action === 'deleteAccount' });
        onDone();
      } catch (error) {
        setProblem(error instanceof ErasureError ? error.reason : 'unknown');
      } finally {
        setBusy(false);
      }
    },
    [auth, state.status, household, needsSuccessor, successor, resetPhone, onDone, i18n.language],
  );

  return {
    signedIn: state.status === 'signedIn',
    /** Which household actions this account has. */
    canLeave: household != null && (!owner || others) && !noGuardian,
    canDeleteHousehold: household != null && owner,
    /** Deleting the account also deletes a household nobody else is in. */
    soleMember: household != null && !others,
    babyName: household?.babyName ?? '',
    /** Who may take over, when this account holds the last owner seat (D3). */
    candidates,
    noGuardian,
    successor,
    setSuccessor,
    /** Leaving or deleting the account waits for a successor to be chosen. */
    ready: (action: ErasureAction) =>
      action === 'deleteHousehold' || !needsSuccessor || (!noGuardian && successor !== null),
    busy,
    problem,
    run,
  };
}
