import type { HouseholdAccess } from '@/domain/consent/consent';
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
 * filling the sync errors list. `no_consent` is P3-09: nothing is written for
 * a caregiver who hasn't agreed to health data being processed, and the
 * server's insert and update policies refuse it anyway, so the phone doesn't
 * try. Reading is not blocked, there or here: what is already in the
 * household stays readable, to export or delete. `no_guardian` is P0.1: an
 * owner's entries wait until the server has said their guardian declaration
 * is on record, and one without it is asked for it. `no_terms` is P0.9: an
 * account that hasn't agreed to the Terms of Use in force syncs nothing.
 * `no_agreement` is P0.2: a member who isn't the baby's parent or guardian
 * sends and reads nothing until they accept the caregiver agreement, and a
 * guardian nothing without consent (`no_consent` again). `checking` is the
 * moment before the server has said which: nothing is sent on a guess, so a
 * refused write can't end up in the sync errors list. `frozen` is P0.3: no
 * guardian in the household has consent in force, so nobody sends. In each
 * of these, deleting this account's own entries still goes (erasure is never
 * held back), and nothing else does.
 */
export type PushBlock =
  | 'signed_out'
  | 'not_linked'
  | 'other_account'
  | 'no_consent'
  | 'no_terms'
  | 'no_agreement'
  | 'checking'
  | 'frozen'
  | 'no_guardian';

/** The blocks that are about access to the household's baby data (P0.2, P0.3). */
const ACCESS_BLOCKS: ReadonlySet<PushBlock> = new Set(['no_consent', 'no_agreement', 'frozen']);
/** How far down the queue to look for deletions while other writes wait. */
const ERASURE_SCAN = 5000;

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
  consented = true,
  guardianMissing = false,
  termsAgreed = true,
  access: HouseholdAccess | 'unknown' = 'granted',
): PushBlock | null {
  if (!auth || state.status !== 'signedIn') return 'signed_out';
  if (!linked) return 'not_linked';
  if (linked.userId !== state.user.id) return 'other_account';
  if (!consented) return 'no_consent';
  if (!termsAgreed) return 'no_terms';
  if (access === 'needs_consent') return 'no_consent';
  if (access === 'needs_agreement') return 'no_agreement';
  if (access === 'frozen') return 'frozen';
  if (access === 'unknown') return 'checking';
  return guardianMissing ? 'no_guardian' : null;
}

type Deps = {
  /** The household and user this phone is linked to, or null before P2-11. */
  linked: () => LinkedIdentity;
  outbox: OutboxRepository;
  auth: Auth | null;
  state: AuthState;
  now: () => number;
  /** Whether this account has agreed to health data being processed (P3-09). */
  consented?: () => boolean;
  /** Whether this owner's guardian declaration is known to be missing (P0.1). */
  guardianMissing?: () => boolean;
  /** Whether this account has agreed to the Terms of Use in force (P0.9). */
  termsAgreed?: () => boolean;
  /** What the server last said this account may do in its household (P0.2). */
  access?: () => HouseholdAccess | 'unknown';
  /**
   * Whether an op deletes one of this account's own entries, which the server
   * accepts whatever its access (P0.3). Without it, nothing is sent while
   * access is in question.
   */
  erasable?: (row: OutboxRow) => boolean;
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

  /**
   * Sends one batch and settles each op by its answer. 'failed' when the
   * batch never got an answer, 'all_held' when every op was deferred.
   */
  async function sendBatch(
    rows: readonly OutboxRow[],
    totals: Record<PushResult['status'], number>,
  ): Promise<'failed' | 'all_held' | 'sent'> {
    let results: PushResult[];
    try {
      results = await send(deps.auth!, rows);
    } catch (error) {
      failures += 1;
      deps.outbox.noteAttempt(
        rows.map((row) => row.id),
        error instanceof PushTransportError ? error.message : 'push failed',
      );
      return 'failed';
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
    lastPushAt = deps.now();
    deps.outbox.done(done);
    deps.outbox.reject(rejected, deps.now());
    // A deferred op stays where it is; counting the try keeps it from
    // looking stuck, and the engine sleeps until its hold is over.
    deps.outbox.noteAttempt(held, null);
    return held.length === rows.length ? 'all_held' : 'sent';
  }

  /**
   * Only the deletions of this account's own entries (P0.3), for an account
   * whose other writes wait. A deletion that something earlier in the queue
   * still waits for (the entry was never sent, or changed since) waits too.
   */
  async function sendErasures(erasable: (row: OutboxRow) => boolean): Promise<PushOutcome | null> {
    const waiting = new Set<string>();
    const rows: OutboxRow[] = [];
    for (const row of deps.outbox.due(deps.now(), ERASURE_SCAN)) {
      if (row.op === 'delete' && !waiting.has(row.entityId) && erasable(row)) rows.push(row);
      else waiting.add(row.entityId);
    }
    const totals = { applied: 0, ignored: 0, deferred: 0, rejected: 0 };
    for (let i = 0; i < rows.length; i += PUSH_BATCH) {
      if ((await sendBatch(rows.slice(i, i + PUSH_BATCH), totals)) === 'failed') {
        return { kind: 'failed', failures, retryInMs: backoffMs(failures) };
      }
    }
    return null;
  }

  async function drain(): Promise<PushOutcome> {
    const blocked = pushBlock(
      deps.linked(),
      deps.auth,
      deps.state,
      deps.consented?.() ?? true,
      deps.guardianMissing?.() ?? false,
      deps.termsAgreed?.() ?? true,
      deps.access?.() ?? 'granted',
    );
    if (blocked) {
      // P0.3: deleting your own entries is never held back.
      if (ACCESS_BLOCKS.has(blocked) && deps.erasable) {
        const failed = await sendErasures(deps.erasable);
        if (failed) return failed;
      }
      return { kind: 'blocked', by: blocked };
    }

    const totals = { applied: 0, ignored: 0, deferred: 0, rejected: 0 };
    let sentAnything = false;

    for (;;) {
      const rows = deps.outbox.due(deps.now(), PUSH_BATCH);
      if (rows.length === 0) break;
      const outcome = await sendBatch(rows, totals);
      if (outcome === 'failed') return { kind: 'failed', failures, retryInMs: backoffMs(failures) };
      sentAnything = true;
      if (outcome === 'all_held') break;
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
        blocked: pushBlock(
          deps.linked(),
          deps.auth,
          deps.state,
          deps.consented?.() ?? true,
          deps.guardianMissing?.() ?? false,
          deps.termsAgreed?.() ?? true,
          deps.access?.() ?? 'granted',
        ),
        lastPushAt,
        failures,
      };
    },
  };
}

export type PushEngine = ReturnType<typeof createPushEngine>;
