import type { OutboxRow } from '@/db/repositories/outbox';

import type { Auth } from './auth';

/** What the server says about each op (SDD 5.2, P2-07). */
export type PushStatus = 'applied' | 'ignored' | 'deferred' | 'rejected';
export type PushResult = {
  id: string | null;
  op: string;
  status: PushStatus;
  reason: string | null;
};

/** The request never reached the server, or the answer never came back. */
export class PushTransportError extends Error {
  override name = 'PushTransportError';
}

/** One outbox row as push_events takes it: the op, its hold, and the body as stored. */
function toOp(row: OutboxRow): unknown {
  return {
    op: row.op,
    ...(row.notBefore === null ? {} : { not_before: row.notBefore }),
    body: JSON.parse(row.body) as unknown,
  };
}

/**
 * Sends a batch to push_events (SDD 5.2). The answers come back in the order
 * sent, one per op. Anything that isn't an answer from the server, no
 * connection, a gateway error, a timeout, is a transport failure: the ops stay
 * in the outbox and the engine waits (backoff) before trying again.
 */
export async function pushOps(auth: Auth, rows: readonly OutboxRow[]): Promise<PushResult[]> {
  const { data, error } = await auth.client.rpc('push_events', { ops: rows.map(toOp) });
  if (error) throw new PushTransportError(error.code ?? error.message);
  const results = data as PushResult[] | null;
  if (!Array.isArray(results) || results.length !== rows.length) {
    throw new PushTransportError('push_events answered for the wrong number of ops');
  }
  return results;
}
