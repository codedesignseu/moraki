import type { OutboxRepository, OutboxRow } from '@/db/repositories/outbox';
import { PUSH_BATCH } from '@/db/repositories/outbox';

import type { Auth } from './auth';
import type { AuthState } from './AuthProvider';
import { backoffMs } from './backoff';
import { pushOps, PushTransportError, type PushResult } from './pushEvents';

/**
 * Why the outbox isn't being sent. `not_linked` is the P1 case: entries made
 * before signing in still carry the placeholder household and user ids
 * migration 0001 seeded, and the server would refuse every one of them
 * (P2-F4). They wait for P2-11 to move them into the household instead of
 * filling the sync errors list.
 */
export type PushBlock = 'signed_out' | 'not_linked' | 'other_account';

export type PushOutcome =
  | { kind: 'blocked'; by: PushBlock }
  | { kind: 'idle' }
  | { kind: 'failed'; failures: number; retryInMs: number }
  | { kind: 'pushed'; applied: number; ignored: number; deferred: number; rejected: number };

export type PushStatus = {
  pending: number;
  errors: number;
  blocked: PushBlock | null;
  lastPushAt: number | null;
  failures: number;
};

export type LinkedIdentity = { householdId: string; userId: string } | null;

export function pushBlock(
  linked: LinkedIdentity,
  auth: Auth | null,
  state: AuthState,
): PushBlock | null {
  if (!auth || state.status !== 'signedIn') return 'signed_out';
  if (!linked) return 'not_linked';
  return linked.userId === state.user.id ? null : 'other_account';
}

type Deps = {
  /** The household and user this phone is linked to, or null before P2-11. */
  linked: () => LinkedIdentity;
  outbox: OutboxRepository;
  auth: Auth | null;
  state: AuthState;
  now: () => number;
  /** Swapped in tests; the real one calls push_events. */
  send?: (auth: Auth, rows: readonly OutboxRow[]) => Promise<PushResult[]>;
};

/**
 * Drains the outbox into push_events (SDD 5.2): up to 100 ops a call, in the
 * order they were written, until nothing is due. Each answer decides what
 * happens to its op: applied and ignored are done with, deferred stays for
 * later, rejected moves to sync_errors so it can never block the queue.
 * A batch that fails in transit changes nothing and is tried again after the
 * backoff wait; sending it twice is safe, because the server is idempotent.
 */
export function createPushEngine(deps: Deps) {
  const send = deps.send ?? pushOps;
  let failures = 0;
  let lastPushAt: number | null = null;
  let running: Promise<PushOutcome> | null = null;

  async function drain(): Promise<PushOutcome> {
    const blocked = pushBlock(deps.linked(), deps.auth, deps.state);
    if (blocked) return { kind: 'blocked', by: blocked };

    const totals = { applied: 0, ignored: 0, deferred: 0, rejected: 0 };
    let sentAnything = false;

    for (;;) {
      const rows = deps.outbox.due(deps.now(), PUSH_BATCH);
      if (rows.length === 0) break;

      let results: PushResult[];
      try {
        results = await send(deps.auth!, rows);
      } catch (error) {
        failures += 1;
        deps.outbox.noteAttempt(
          rows.map((row) => row.id),
          error instanceof PushTransportError ? error.message : 'push failed',
        );
        return { kind: 'failed', failures, retryInMs: backoffMs(failures) };
      }

      const done: number[] = [];
      const rejected: { row: OutboxRow; reason: string }[] = [];
      const held: number[] = [];
      results.forEach((result, i) => {
        const row = rows[i]!;
        if (result.status === 'applied' || result.status === 'ignored') done.push(row.id);
        else if (result.status === 'rejected')
          rejected.push({ row, reason: result.reason ?? 'unknown' });
        else held.push(row.id);
        totals[result.status] += 1;
      });

      failures = 0;
      sentAnything = true;
      lastPushAt = deps.now();
      deps.outbox.done(done);
      deps.outbox.reject(rejected, deps.now());
      // A deferred op stays where it is; counting the try keeps it from
      // looking stuck, and the engine sleeps until its hold is over.
      deps.outbox.noteAttempt(held, null);
      if (held.length === rows.length) break;
    }

    return sentAnything ? { kind: 'pushed', ...totals } : { kind: 'idle' };
  }

  return {
    /** One drain at a time; a second call joins the one in flight. */
    push(): Promise<PushOutcome> {
      running ??= drain().finally(() => {
        running = null;
      });
      return running;
    },

    /** Back online or back in the foreground: try again now, not after the wait. */
    resetBackoff(): void {
      failures = 0;
    },

    status(): PushStatus {
      return {
        pending: deps.outbox.pending(),
        errors: deps.outbox.errors().length,
        blocked: pushBlock(deps.linked(), deps.auth, deps.state),
        lastPushAt,
        failures,
      };
    },
  };
}

export type PushEngine = ReturnType<typeof createPushEngine>;
