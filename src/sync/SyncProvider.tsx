import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';

import {
  useCaregiversRepository,
  useEvents,
  useEventsRepository,
  useLinkedIdentity,
  useOutboxRepository,
} from '@/db/react';

import { useAuth } from './AuthProvider';
import { createPullEngine, type PullEngine } from './pullEngine';
import { createPushEngine, type PushEngine, type PushStatus } from './pushEngine';

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
export function SyncProvider({ children }: { children: ReactNode }) {
  const outbox = useOutboxRepository();
  const eventsRepository = useEventsRepository();
  const caregivers = useCaregiversRepository();
  const linked = useLinkedIdentity();
  const { auth, state } = useAuth();
  // Re-pushes after every committed write (the events repository's signal).
  const events = useEvents();
  const [status, setStatus] = useState<PushStatus>(EMPTY);

  const engine = useMemo(
    () => createPushEngine({ linked, outbox, auth, state, now: Date.now }),
    [linked, outbox, auth, state],
  );
  const pull = useMemo(
    () => createPullEngine({ linked, events: eventsRepository, outbox, caregivers, auth, state }),
    [linked, eventsRepository, outbox, caregivers, auth, state],
  );

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

    run();
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
    };
  }, [engine, pull, outbox, events]);

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
