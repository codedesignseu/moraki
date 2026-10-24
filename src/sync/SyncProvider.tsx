import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AppState } from 'react-native';

import {
  useCaregiversRepository,
  useDevicePref,
  useSyncDevicePrefs,
  useEvents,
  useEventsRepository,
  useLinkedIdentity,
  useOutboxRepository,
  useResetPhone,
} from '@/db/react';
import type { OutboxRow } from '@/db/repositories/outbox';
import {
  accessStatus,
  agreedToCurrent,
  guardianStatus,
  termsStatus,
  type HouseholdAccess,
} from '@/domain/consent/consent';

import { useAuth } from './AuthProvider';
import { fetchMembershipStatus } from './membershipStatus';
import { createPullEngine, type PullEngine, type Revocation } from './pullEngine';
import { pushBlock } from './pushEngine';
import { watchHousehold } from './realtime';
import { createPushEngine, type PushEngine, type PushStatus } from './pushEngine';
import { useLinkHousehold } from './useAdoption';

/** Every 60 seconds while the app is open, as SDD 5.4's safety net. */
export const PULL_EVERY_MS = 60_000;

const SyncContext = createContext<{
  engine: PushEngine | null;
  pull: PullEngine | null;
  status: PushStatus | null;
}>({ engine: null, pull: null, status: null });

const EMPTY: PushStatus = {
  pending: 0,
  errors: 0,
  blocked: 'signed_out',
  lastPushAt: null,
  failures: 0,
};

/**
 * Pushes the outbox whenever there is something to send (SDD 5.1 step 4):
 * after every write, when the app comes back to the foreground, and again
 * after the backoff wait when a push didn't reach the server. P2-09 adds
 * pulling; P2-13 shows `status`.
 */
export function SyncProvider({
  children,
  watch = watchHousehold,
}: {
  children: ReactNode;
  /** Swapped in tests; the real one subscribes to the household's events. */
  watch?: typeof watchHousehold;
}) {
  const outbox = useOutboxRepository();
  const eventsRepository = useEventsRepository();
  const caregivers = useCaregiversRepository();
  const devicePrefs = useSyncDevicePrefs();
  const linked = useLinkedIdentity();
  const { auth, state } = useAuth();
  // P3-09, P0.2: nothing syncs for a guardian who hasn't agreed to health
  // data being processed, to the version in force. The server refuses it
  // too; this stops the phone asking. Since P0.2 consent is the guardian's:
  // anyone else accepts the caregiver agreement instead (`access` below).
  const [consent] = useDevicePref('consent');
  const userId = state.status === 'signedIn' ? state.user.id : null;
  const [accountHousehold] = useDevicePref('accountHousehold');
  const [accessRecord] = useDevicePref('householdAccess');
  // The household this phone sends to and reads from, which is the one the
  // pull asked the server about.
  const householdId = linked()?.householdId ?? null;
  const known = accessRecord?.userId === userId && accessRecord?.householdId === householdId;
  const guardianHere = known ? accessRecord.isGuardian : accountHousehold?.role === 'owner';
  const consentOk = !guardianHere || agreedToCurrent(consent, userId);
  // P0.2: what the server last said this account may do in its household.
  const access = accessStatus(accessRecord, userId, householdId);
  // P0.1: an owner waits until the server has said their guardian
  // declaration is on record: nothing of theirs syncs before it has.
  const [guardian] = useDevicePref('guardianDeclaration');
  const missing =
    accountHousehold?.role === 'owner' &&
    guardianStatus(guardian, userId, accountHousehold.householdId) !== 'on_record';
  // P0.9: nothing syncs until this account has agreed to the Terms in force.
  const [terms] = useDevicePref('terms');
  const agreedTerms = termsStatus(terms, userId) === 'agreed';
  // All of these are read when the engine runs, from a map kept outside React's
  // state: answering starts a cycle (below) rather than making a new engine,
  // which would drop and rejoin the realtime channel, and a pull rewriting
  // the household record changes nothing here.
  const [gates] = useState(
    () =>
      new Map<
        'consented' | 'guardianMissing' | 'termsAgreed' | 'access',
        boolean | HouseholdAccess | 'unknown'
      >([
        ['consented', consentOk],
        ['guardianMissing', missing],
        ['termsAgreed', agreedTerms],
        ['access', access],
      ]),
  );
  const consented = useCallback(() => gates.get('consented') === true, [gates]);
  const guardianMissing = useCallback(() => gates.get('guardianMissing') === true, [gates]);
  const termsAgreed = useCallback(() => gates.get('termsAgreed') === true, [gates]);
  const accessNow = useCallback(() => gates.get('access') as HouseholdAccess | 'unknown', [gates]);
  // P0.3: while this account's other writes wait, deleting its own entries
  // still goes; the server accepts that whatever its access.
  const erasable = useCallback(
    (row: OutboxRow) =>
      row.op === 'delete' && eventsRepository.get(row.entityId)?.createdBy === linked()?.userId,
    [eventsRepository, linked],
  );
  // P0.5: the server says this account is no longer in its household, or the
  // household is gone. Everything of it leaves the phone (entries, the
  // outbox, so nothing stale is sent, and with the entries every reminder
  // computed from them); the account stays signed in unless it was deleted
  // too. A notice says why, once.
  const resetPhone = useResetPhone();
  const onRevoked = useCallback(
    async (reason: Revocation) => {
      const gone = auth ? (await auth.accountExists()) === false : false;
      resetPhone({ forgetAccount: gone });
      devicePrefs.set('revokedNotice', gone ? 'account_gone' : reason);
      if (gone) await auth?.signOut();
    },
    [auth, resetPhone, devicePrefs],
  );
  // Re-pushes after every committed write (the events repository's signal).
  const events = useEvents();
  // Links the phone once the account has a household, whichever screen is open.
  useLinkHousehold();
  // Which household this phone is linked to, read again on every change signal:
  // linking (or resetting) tells the events repository to forget its ids, which
  // re-renders here. A new link means a first pull and a realtime channel now,
  // not after the next 60-second read.
  const linkedNow = linked();
  const link = linkedNow ? `${linkedNow.householdId}/${linkedNow.userId}` : null;
  const [status, setStatus] = useState<PushStatus>(EMPTY);
  // The current cycle, so a write can start one without the subscription
  // being torn down and made again every time something is logged.
  const cycle = useRef<() => void>(() => {});

  const engine = useMemo(
    () =>
      createPushEngine({
        linked,
        outbox,
        auth,
        state,
        now: Date.now,
        consented,
        guardianMissing,
        termsAgreed,
        access: accessNow,
        erasable,
      }),
    [linked, outbox, auth, state, consented, guardianMissing, termsAgreed, accessNow, erasable],
  );
  const pull = useMemo(
    () =>
      createPullEngine({
        linked,
        events: eventsRepository,
        outbox,
        caregivers,
        devicePrefs,
        auth,
        state,
        fetchStatus: fetchMembershipStatus,
        onRevoked,
      }),
    [linked, eventsRepository, outbox, caregivers, devicePrefs, auth, state, onRevoked],
  );

  // The Terms agreed, the guardian declaration on record, or the server's
  // answer about access (P0.9, P0.1, P0.2): what was waiting goes now.
  // Declared before the cycle below, so it reads the new answer.
  useEffect(() => {
    gates.set('consented', consentOk);
    gates.set('guardianMissing', missing);
    gates.set('termsAgreed', agreedTerms);
    gates.set('access', access);
    cycle.current();
  }, [gates, consentOk, missing, agreedTerms, access]);

  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const run = () => {
      if (!active) return;
      void engine
        .push()
        // Reading follows sending (SDD 5.4): whatever the push did, this phone
        // then catches up on what the others have logged.
        .then(async (outcome) => {
          await pull.pull();
          return outcome;
        })
        .then((outcome) => {
          if (!active) return;
          setStatus(engine.status());
          clearTimeout(timer);
          if (outcome.kind === 'failed') {
            timer = setTimeout(run, outcome.retryInMs);
            return;
          }
          // Whichever comes first: an op whose hold (P1-12's undo window) is
          // over, or the next safety-net read.
          const held = outbox.nextDueAt(Date.now());
          const wait =
            held === null ? PULL_EVERY_MS : Math.min(Math.max(held - Date.now(), 0), PULL_EVERY_MS);
          timer = setTimeout(run, wait);
        });
    };

    cycle.current = run;
    run();

    // The other phone's entries arrive as a ping (SDD 5.4): never the row
    // itself, only "something changed here", which starts the same cycle.
    // Joining the channel again is how a phone notices it is back online.
    const current = linked();
    const blocked = pushBlock(current, auth, state);
    const watching =
      auth && current && !blocked
        ? watch(auth, current.householdId, {
            onPing: run,
            onConnected: () => {
              engine.resetBackoff();
              pull.resetBackoff();
              run();
            },
          })
        : null;

    const subscription = AppState.addEventListener('change', (next) => {
      if (next !== 'active') return;
      engine.resetBackoff();
      pull.resetBackoff();
      run();
    });
    return () => {
      active = false;
      clearTimeout(timer);
      subscription.remove();
      watching?.close();
    };
  }, [engine, pull, outbox, linked, link, auth, state, watch]);

  // Every committed write starts a cycle: send it, then read what else is new
  // (SDD 5.1 step 4). The subscription above is left alone.
  useEffect(() => {
    cycle.current();
  }, [events]);

  const value = useMemo(() => ({ engine, pull, status }), [engine, pull, status]);
  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>;
}

/** What P2-13's sync status screen reads. */
export function useSyncStatus(): PushStatus {
  return useContext(SyncContext).status ?? EMPTY;
}

export function useSyncEngine(): PushEngine | null {
  return useContext(SyncContext).engine;
}

export function usePullEngine(): PullEngine | null {
  return useContext(SyncContext).pull;
}
