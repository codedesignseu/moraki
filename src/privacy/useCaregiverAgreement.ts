import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useDevicePref } from '@/db/react';
import { accessStatus, consentLocale } from '@/domain/consent/consent';
import { useAuth } from '@/sync/AuthProvider';
import { recordCaregiverAgreement } from '@/sync/membershipStatus';
import { useAccountHousehold } from '@/sync/useAccountHousehold';

export type AgreementProblem = 'unticked' | 'offline' | 'unknown';

/**
 * The caregiver agreement for the signed-in account's household (P0.2).
 * Someone who isn't the baby's parent or guardian doesn't consent for the
 * baby: they accept this, once per household, before seeing it. New members
 * accept it as they join (useJoin); members from before it existed are
 * asked here, and until they accept, their phone neither reads nor sends.
 *
 * `access` is what the server last said (`my_membership_status`, kept by
 * each pull), so the question is asked only when the server says so.
 */
export function useCaregiverAgreement() {
  const { auth, state } = useAuth();
  const { household } = useAccountHousehold();
  const [record, setRecord] = useDevicePref('householdAccess');
  const { i18n } = useTranslation();
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<AgreementProblem | null>(null);
  const userId = state.status === 'signedIn' ? state.user.id : null;
  const householdId = household?.householdId ?? null;
  const access = accessStatus(record, userId, householdId);
  const known = access !== 'unknown' && record !== null;
  // Before the server has said, an owner is taken as the guardian they are
  // (P0.1), and anyone else as someone the agreement is for.
  const isGuardian = known ? record.isGuardian : household?.role === 'owner';

  const accept = useCallback(
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
        await recordCaregiverAgreement(auth, householdId, consentLocale(i18n.language));
        setRecord({ userId, householdId, access: 'granted', isGuardian });
        return true;
      } catch (error) {
        setProblem(error instanceof Error && error.message === 'offline' ? 'offline' : 'unknown');
        return false;
      } finally {
        setBusy(false);
      }
    },
    [auth, userId, householdId, isGuardian, i18n.language, setRecord],
  );

  return {
    access,
    /** Whether the agreement, rather than health-data consent, is this account's to give. */
    forThisAccount: household != null && !isGuardian,
    accepted: !isGuardian && access === 'granted',
    role: household?.role ?? null,
    babyName: household?.babyName ?? '',
    busy,
    problem,
    accept,
  };
}
