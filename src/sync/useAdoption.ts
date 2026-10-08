import { useEffect, useMemo } from 'react';

import {
  useAdoption as useRepositories,
  useDevicePref,
  useEvents,
  useEventsRepository,
  useLinkedIdentity,
  useResetPhone,
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

/**
 * Links this phone to the account's household as soon as there is one: after
 * signing in, creating a household, or joining one by invite. Mounted once,
 * by SyncProvider, so it runs whichever screen is open; it used to live in
 * Settings, and a phone that never opened Settings never linked (TestFlight
 * build 2).
 *
 * Linking changes the ids the events repository lists by, so it is told to
 * read them again even when no entry moved. Without that, a phone with
 * nothing of its own kept listing the placeholder baby, and home and history
 * stayed empty until a restart.
 */
export function useLinkHousehold(): void {
  const { localOnly, adopt } = useRepositories();
  const events = useEventsRepository();
  const { household } = useAccountHousehold();
  const { state } = useAuth();
  const [answer] = useDevicePref('localEntries');

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
      if (moved.linked) events.forgetIdentity();
    }
  }, [mine, owner, answer, adopt, localOnly, events]);
}

export function useAdoption(): {
  question: AdoptionQuestion;
  /**
   * This phone is linked to another account or household: it still holds the
   * entries of an account that signed out keeping them (D6). They stay apart,
   * never moved and never sent, until the phone is cleared (P5-F11).
   */
  otherAccount: boolean;
  /** Clears the phone, after which it links to this account's household. */
  clearPhone: () => void;
  /** How many entries would move. */
  entries: number;
  babyName: string;
  move: () => void;
  keepForNow: () => void;
} {
  const { localOnly } = useRepositories();
  const linked = useLinkedIdentity();
  const resetPhone = useResetPhone();
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
  const otherAccount = useMemo(() => {
    const current = linked();
    return (
      mine !== null &&
      current !== null &&
      (current.userId !== mine.userId || current.householdId !== mine.householdId)
    );
    // `logged` is the change signal: linking and clearing both re-read here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linked, mine, logged]);

  return {
    otherAccount,
    clearPhone: () => resetPhone({ forgetAccount: false }),
    question: mine && !owner && entries > 0 && answer === null ? 'ask' : 'none',
    entries,
    babyName: mine?.babyName ?? '',
    move: () => setAnswer('move'),
    keepForNow: () => setAnswer('keep'),
  };
}
