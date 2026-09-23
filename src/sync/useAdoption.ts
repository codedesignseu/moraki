import { useEffect, useMemo } from 'react';

import {
  useAdoption as useRepositories,
  useDevicePref,
  useEvents,
  useEventsRepository,
} from '@/db/react';

import { useAuth } from './AuthProvider';
import { useAccountHousehold } from './useAccountHousehold';

/**
 * What a phone still has to decide about the entries it made before it had an
 * account (P2-11).
 *
 * - `none`: nothing to move, or already moved.
 * - `ask`: this phone joined someone else's household and has entries of its
 *   own. They may be the same feeds the household already has, logged twice,
 *   so the caregiver decides (decision D1). Until they do, the phone keeps
 *   working exactly as it did and syncs nothing.
 *
 * A household's own creator is never asked: the household was made for this
 * phone's history, and its entries move as soon as it is set up.
 */
export type AdoptionQuestion = 'none' | 'ask';

export function useAdoption(): {
  question: AdoptionQuestion;
  /** How many entries would move. */
  entries: number;
  babyName: string;
  move: () => void;
  keepForNow: () => void;
} {
  const { localOnly, adopt } = useRepositories();
  const events = useEventsRepository();
  const { household } = useAccountHousehold();
  const { state } = useAuth();
  const [answer, setAnswer] = useDevicePref('localEntries');
  // Recounted after every committed write, straight from the database.
  const logged = useEvents();
  const entries = useMemo(
    () => localOnly(),
    // `logged` is the change signal: re-read after every committed write.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [localOnly, logged],
  );

  const signedIn = state.status === 'signedIn';
  const mine = household && signedIn ? household : null;
  const owner = mine?.role === 'owner';

  useEffect(() => {
    if (!mine) return;
    // The creator's own history, and any phone with nothing of its own to
    // lose, moves without being asked.
    if (owner || localOnly() === 0 || answer === 'move') {
      const moved = adopt(
        {
          userId: mine.userId,
          householdId: mine.householdId,
          babyId: mine.babyId,
          babyName: mine.babyName,
        },
        Date.now(),
      );
      if (moved.events > 0 || moved.ops > 0) events.forgetIdentity();
    }
  }, [mine, owner, answer, adopt, localOnly, events]);

  return {
    question: mine && !owner && entries > 0 && answer === null ? 'ask' : 'none',
    entries,
    babyName: mine?.babyName ?? '',
    move: () => setAnswer('move'),
    keepForNow: () => setAnswer('keep'),
  };
}
