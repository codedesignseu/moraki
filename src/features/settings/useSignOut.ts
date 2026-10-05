import { useCallback, useMemo, useState } from 'react';

import { useAdoption, useEvents, useResetPhone } from '@/db/react';
import { useAuth } from '@/sync/AuthProvider';
import { useSyncStatus } from '@/sync/SyncProvider';

/**
 * Signing out asks whether to keep this phone's entries or clear the phone
 * (P5-F1, decision D6). Keeping is what signing out always did. Clearing
 * returns the phone to a first launch, as leaving a household does, so the
 * next account to sign in here doesn't see the last one's baby.
 */
export function useSignOut() {
  const { auth } = useAuth();
  const resetPhone = useResetPhone();
  const { localOnly } = useAdoption();
  const sync = useSyncStatus();
  const logged = useEvents();
  const [asking, setAsking] = useState(false);

  /**
   * Changes that exist only on this phone, lost if it is cleared: the outbox,
   * or the entries made before this phone joined a household. Those entries
   * are in the outbox too, so the larger of the two counts, not their sum.
   */
  const unsent = useMemo(
    () => Math.max(sync.pending, localOnly()),
    // `logged` is the change signal: recount after every committed write.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sync.pending, localOnly, logged],
  );

  const signOut = useCallback(
    async (clear: boolean) => {
      setAsking(false);
      await auth?.signOut();
      if (clear) resetPhone({ forgetAccount: true });
    },
    [auth, resetPhone],
  );

  return {
    asking,
    ask: () => setAsking(true),
    cancel: () => setAsking(false),
    unsent,
    keep: () => void signOut(false),
    clear: () => void signOut(true),
  };
}
