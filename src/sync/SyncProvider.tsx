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
} from '@/db/react';
import { agreedToCurrent, guardianStatus, termsStatus } from '@/domain/consent/consent';

import { useAuth } from './AuthProvider';
import { createPullEngine, type PullEngine } from './pullEngine';
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
  // P3-09: nothing syncs for an account that hasn't agreed to health data
  // being processed, to the version in force. The server refuses it too; this
  // stops the phone asking.
  const [consent] = useDevicePref('consent');
  const userId = state.status === 'signedIn' ? state.user.id : null;
  const consented = useCallback(() => agreedToCurrent(consent, userId), [consent, userId]);
  // P0.1: an owner waits until the server has said their guardian
  // declaration is on record: nothing of theirs syncs before it has.
  const [guardian] = useDevicePref('guardianDeclaration');
  const [accountHousehold] = useDevicePref('accountHousehold');
  const missing =
    accountHousehold?.role === 'owner' &&
    guardianStatus(guardian, userId, accountHousehold.householdId) !== 'on_record';
  // P0.9: nothing syncs until this account has agreed to the Terms in force.
  const [terms] = useDevicePref('terms');
  const agreedTerms = termsStatus(terms, userId) === 'agreed';
  // Both are read when the engine runs, from a map kept outside React's
  // state: answering starts a cycle (below) rather than making a new engine,
  // which would drop and rejoin the realtime channel, and a pull rewriting
  // the household record changes nothing here.
  const [gates] = useState(
    () =>
      new Map<'guardianMissing' | 'termsAgreed', boolean>([
        ['guardianMissing', missing],
        ['termsAgreed', agreedTerms],
      ]),
  );
  const guardianMissing = useCallback(() => gates.get('guardianMissing') === true, [gates]);
  const termsAgreed = useCallback(() => gates.get('termsAgreed') === true, [gates]);
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
      }),
    [linked, outbox, auth, state, consented, guardianMissing, termsAgreed],
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
      }),
    [linked, eventsRepository, outbox, caregivers, devicePrefs, auth, state],
  );

  // The Terms agreed or the guardian declaration on record (P0.9, P0.1):
  // what was waiting goes now. Declared before the cycle below, so it reads
  // the new answer.
  useEffect(() => {
    gates.set('guardianMissing', missing);
    gates.set('termsAgreed', agreedTerms);
    cycle.current();
  }, [gates, missing, agreedTerms]);

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
