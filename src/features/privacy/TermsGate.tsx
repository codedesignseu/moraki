import { useEffect, useRef } from 'react';

import { useTerms } from '@/privacy/useTerms';
import { useAuth } from '@/sync/AuthProvider';
import { termsOnRecord } from '@/sync/terms';

/**
 * Once per app open, for a signed-in account this phone hasn't seen agree to
 * the Terms in force (P0.9, P1.4): asks the server, which may have it from
 * another phone, and opens the Terms screen once if it hasn't. Draws
 * nothing. Until it is agreed, this account's entries wait (SyncProvider).
 */
export function TermsGate({ onMissing }: { onMissing: () => void }) {
  const { auth, state } = useAuth();
  const terms = useTerms();
  const { remember } = terms;
  const shown = useRef(false);
  const userId = state.status === 'signedIn' ? state.user.id : null;
  const ask = userId !== null && !terms.agreed;

  useEffect(() => {
    if (!auth || !userId || !ask) return;
    let active = true;
    void termsOnRecord(auth, userId).then((found) => {
      if (!active || found === null) return;
      if (found) remember();
      else if (!shown.current) {
        shown.current = true;
        onMissing();
      }
    });
    return () => {
      active = false;
    };
  }, [auth, userId, ask, remember, onMissing]);

  return null;
}
