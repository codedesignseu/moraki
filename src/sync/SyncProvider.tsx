import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';

import { useEvents, useLinkedIdentity, useOutboxRepository } from '@/db/react';

import { useAuth } from './AuthProvider';
import { createPushEngine, type PushEngine, type PushStatus } from './pushEngine';

const SyncContext = createContext<{ engine: PushEngine | null; status: PushStatus | null }>({
  engine: null,
  status: null,
});

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
  const linked = useLinkedIdentity();
  const { auth, state } = useAuth();
  // Re-pushes after every committed write (the events repository's signal).
  const events = useEvents();
  const [status, setStatus] = useState<PushStatus>(EMPTY);

  const engine = useMemo(
    () => createPushEngine({ linked, outbox, auth, state, now: Date.now }),
    [linked, outbox, auth, state],
  );

  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const run = () => {
      if (!active) return;
      void engine.push().then((outcome) => {
        if (!active) return;
        setStatus(engine.status());
        clearTimeout(timer);
        if (outcome.kind === 'failed') {
          timer = setTimeout(run, outcome.retryInMs);
          return;
        }
        // Anything still held (P1-12's undo window) is due later.
        const next = outbox.nextDueAt(Date.now());
        if (next !== null) timer = setTimeout(run, Math.max(next - Date.now(), 0));
      });
    };

    run();
    const subscription = AppState.addEventListener('change', (next) => {
      if (next !== 'active') return;
      engine.resetBackoff();
      run();
    });
    return () => {
      active = false;
      clearTimeout(timer);
      subscription.remove();
    };
  }, [engine, outbox, events]);

  const value = useMemo(() => ({ engine, status }), [engine, status]);
  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>;
}

/** What P2-13's sync status screen reads. */
export function useSyncStatus(): PushStatus {
  return useContext(SyncContext).status ?? EMPTY;
}

export function useSyncEngine(): PushEngine | null {
  return useContext(SyncContext).engine;
}
