/**
 * What a pull may overwrite, and what it may not (SDD 5.3).
 *
 * A phone can hold writes the server hasn't taken yet. A pull can bring back
 * the server's older copy of the same event, so applying it wholesale would
 * undo an edit the user has already made and can see. The rule: for every
 * field a waiting op touches, the local value stays; everything else takes
 * the server's value, which is newer for those fields.
 */

/** An event as the server keeps it (SDD 4.2), in local column names. */
export type PulledEvent = {
  id: string;
  householdId: string;
  babyId: string;
  type: string;
  occurredAt: number;
  endedAt: number | null;
  payload: Record<string, unknown>;
  groupId: string | null;
  createdBy: string;
  updatedBy: string;
  clientCreatedAt: number;
  serverUpdatedAt: number | null;
  seq: number | null;
  deletedAt: number | null;
};

/** A write still waiting in the outbox, as far as this rule cares. */
export type PendingOp =
  | { op: 'insert' }
  | {
      op: 'patch';
      payload?: Record<string, unknown> | undefined;
      unset?: readonly string[] | undefined;
      occurredAt?: number | undefined;
      endedAt?: number | null | undefined;
    }
  | { op: 'delete'; deletedAt: number };

/**
 * The row to store for a pulled event, or null to leave the local one alone.
 *
 * - An unsent insert means the server can't know this event at all; anything
 *   coming back under that id is older than what is here.
 * - An unsent patch keeps its own fields: the payload keys it sets, the keys
 *   it clears, and the times it moves.
 * - An unsent delete keeps the event deleted; a pull can't undelete it.
 */
export function protectPending(
  server: PulledEvent,
  local: PulledEvent | null,
  pending: readonly PendingOp[],
): PulledEvent | null {
  if (pending.some((op) => op.op === 'insert')) return null;
  if (pending.length === 0 || local === null) return server;

  let merged: PulledEvent = { ...server };
  for (const op of pending) {
    if (op.op === 'delete') {
      merged = { ...merged, deletedAt: local.deletedAt ?? op.deletedAt };
      continue;
    }
    if (op.op !== 'patch') continue;
    const payload = { ...merged.payload };
    for (const key of Object.keys(op.payload ?? {})) payload[key] = local.payload[key];
    for (const key of op.unset ?? []) delete payload[key];
    merged = {
      ...merged,
      payload,
      ...(op.occurredAt !== undefined ? { occurredAt: local.occurredAt } : {}),
      ...(op.endedAt !== undefined ? { endedAt: local.endedAt } : {}),
    };
  }
  return merged;
}
