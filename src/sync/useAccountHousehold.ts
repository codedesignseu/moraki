import { useEffect } from 'react';

import { useDevicePref } from '@/db/react';

import { useAuth } from './AuthProvider';
import { findHousehold, type AccountHousehold } from './household';

/**
 * The signed-in account's household, from this phone's record (rule 1: read
 * from SQLite). With no record yet, it asks the server once in the background,
 * so a reinstalled phone or a second phone finds the household it already has
 * instead of offering to create another. `undefined` while signed out.
 */
export function useAccountHousehold(): {
  household: AccountHousehold | null | undefined;
  remember: (household: AccountHousehold) => void;
} {
  const { auth, state } = useAuth();
  const [record, setRecord] = useDevicePref('accountHousehold');
  const userId = state.status === 'signedIn' ? state.user.id : null;
  // A record from another account on this phone doesn't count.
  const mine = record && record.userId === userId ? record : null;

  useEffect(() => {
    if (!auth || !userId || mine) return;
    let active = true;
    findHousehold(auth, userId).then(
      (found) => active && found && setRecord(found),
      () => {}, // Offline or unreachable: try again next time.
    );
    return () => {
      active = false;
    };
  }, [auth, userId, mine, setRecord]);

  return { household: userId ? mine : undefined, remember: setRecord };
}
