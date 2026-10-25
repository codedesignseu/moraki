import { useEffect, useRef } from 'react';

import { useGuardianDeclaration } from '@/privacy/useGuardianDeclaration';
import { useTerms } from '@/privacy/useTerms';
import { useAuth } from '@/sync/AuthProvider';
import { guardianOnRecord } from '@/sync/guardian';
import { useAccountHousehold } from '@/sync/useAccountHousehold';

/**
 * Asks the server, once per app open, whether this owner's guardian
 * declaration is on record (P0.1), and opens the declaration screen once if
 * it isn't. Owners from before the declaration existed are asked this way.
 * Draws nothing. Until the server answers, the owner's entries wait on the
 * phone (SyncProvider); offline, it asks again on the next open.
 */
export function GuardianGate({ onMissing }: { onMissing: () => void }) {
  const { auth, state } = useAuth();
  const { household } = useAccountHousehold();
  const guardian = useGuardianDeclaration();
  const { remember } = guardian;
  // The Terms come first: one screen at a time.
  const { agreed: termsAgreed } = useTerms();
  const shown = useRef(false);
  const userId = state.status === 'signedIn' ? state.user.id : null;
  const householdId = household?.householdId ?? null;
  const ask = guardian.owner && guardian.status !== 'on_record';

  useEffect(() => {
    if (!auth || !userId || !householdId || !ask) return;
    let active = true;
    void guardianOnRecord(auth, userId, householdId).then((found) => {
      if (active && found !== null) remember(found);
    });
    return () => {
      active = false;
    };
  }, [auth, userId, householdId, ask, remember]);

  useEffect(() => {
    if (guardian.owner && guardian.status === 'missing' && termsAgreed && !shown.current) {
      shown.current = true;
      onMissing();
    }
  }, [guardian.owner, guardian.status, termsAgreed, onMissing]);

  return null;
}
