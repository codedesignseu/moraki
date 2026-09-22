import { and, desc, eq, gt, inArray, isNull } from 'drizzle-orm';

import { getActivity, type Event, type EventType } from '@/domain/activities';

import { readIdentity, type Identity, type SyncDb } from '../identity';
import { events, outbox } from '../schema';

export type EventsRepositoryDeps = {
  /** UTC epoch ms. The db layer may read the clock; injected so tests control it. */
  now: () => number;
  newId: (now: number) => string;
};

export type NewEvent = {
  type: EventType;
  occurredAt: number;
  endedAt?: number | null;
  payload: unknown;
  groupId?: string | null;
};

export type EventChanges = {
  occurredAt?: number;
  endedAt?: number | null;
  /** Only the payload fields that change. Merged onto the stored payload. */
  payload?: Record<string, unknown>;
  /**
   * Optional payload fields to remove, e.g. a cleared temperature. Only fields
   * this app version knows can be removed, so a newer app's fields are never
   * dropped (P1-F1). Sent to the server as `unset`.
   */
  unset?: readonly string[];
};

/** How long a save can be undone (P1-12). Deletes are held back from sync this long. */
export const UNDO_WINDOW_MS = 6_000;

/** An event row exactly as stored, captured before a change so it can be undone. */
export type EventSnapshot = typeof events.$inferSelect;

export class EventWriteError extends Error {
  constructor(
    readonly reason:
      | 'unknown_type'
      | 'invalid_payload'
      | 'unknown_fields'
      | 'not_found'
      | 'deleted'
      | 'not_undoable',
    message: string,
  ) {
    super(message);
    this.name = 'EventWriteError';
  }
}

type EventRow = typeof events.$inferSelect;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function moduleFor(type: string) {
  const module = getActivity(type as EventType);
  if (!module) throw new EventWriteError('unknown_type', `No activity module for ${type}`);
  return module;
}

/**
 * Payload policy (P1-F1): strict on what this app writes, lossless on what it
 * stores. A payload this app writes may only contain fields its schema knows,
 * so a typo fails loudly instead of being stripped. A stored payload may carry
 * fields from a newer app version; they are kept as they are, and patches only
 * send the fields that change, so nothing a newer phone wrote is ever dropped.
 */
function validate(type: string, payload: unknown, writtenKeys: string[]): void {
  const result = moduleFor(type).schema.safeParse(payload);
  if (!result.success) {
    throw new EventWriteError('invalid_payload', `Invalid ${type} payload`);
  }
  const known = isRecord(result.data) ? result.data : {};
  const unknown = writtenKeys.filter((key) => !(key in known));
  if (unknown.length > 0) {
    throw new EventWriteError('unknown_fields', `Unknown ${type} fields: ${unknown.join(', ')}`);
  }
}

/**
 * A stored row as the domain sees it, or null if it can't be shown: its type
 * has no activity module, or its payload no longer validates. Such a row is
 * never shown half-parsed, but it doesn't vanish silently either: a warning
 * names its id. Only the id, never the payload (rule 8).
 */
function toEvent(row: EventRow): Event<unknown> | null {
  const module = getActivity(row.type as EventType);
  if (!module) {
    console.warn(`[moraki] Event ${row.id} skipped: no activity module for its type`);
    return null;
  }
  const parsed = module.schema.safeParse(row.payload);
  if (!parsed.success) {
    console.warn(`[moraki] Event ${row.id} skipped: stored payload failed validation`);
    return null;
  }
  return {
    id: row.id,
    householdId: row.householdId,
    babyId: row.babyId,
    type: module.type,
    occurredAt: row.occurredAt,
    endedAt: row.endedAt,
    payload: parsed.data,
    groupId: row.groupId,
    createdBy: row.createdBy,
    updatedBy: row.updatedBy,
    clientCreatedAt: row.clientCreatedAt,
    deletedAt: row.deletedAt,
  };
}

/** The outbox op for a patch, in the server's column names (SDD 5.2). */
function patchOp(id: string, userId: string, changes: EventChanges, now: number) {
  return {
    entity: 'event' as const,
    entityId: id,
    op: 'patch' as const,
    body: JSON.stringify({
      id,
      updated_by: userId,
      ...(changes.payload && { payload: changes.payload }),
      ...(changes.unset && changes.unset.length > 0 && { unset: changes.unset }),
      ...(changes.occurredAt !== undefined && { occurred_at: changes.occurredAt }),
      ...(changes.endedAt !== undefined && { ended_at: changes.endedAt }),
    }),
    createdAt: now,
  };
}

/**
 * The only way the app writes events (rule 2): every write stores the event and
 * its outbox op in one transaction, so both commit or neither does. Outbox
 * bodies use the server's column names, ready for push_events (SDD 5.2).
 */
export function createEventsRepository(db: SyncDb, deps: EventsRepositoryDeps) {
  const listeners = new Set<() => void>();
  let writes = 0;
  let identity: Identity | undefined;
  const me = () => (identity ??= readIdentity(db));

  function changed() {
    writes += 1;
    for (const listener of listeners) listener();
  }

  function stored(id: string): EventRow {
    const row = db.select().from(events).where(eq(events.id, id)).get();
    if (!row) throw new EventWriteError('not_found', `No event ${id}`);
    return row;
  }

  function insertAll(inputs: NewEvent[], groupId: string | null): Event<unknown>[] {
    for (const input of inputs) {
      validate(
        input.type,
        input.payload,
        isRecord(input.payload) ? Object.keys(input.payload) : [],
      );
    }
    const now = deps.now();
    const { householdId, babyId, userId } = me();
    const rows: EventRow[] = inputs.map((input) => ({
      id: deps.newId(now),
      householdId,
      babyId,
      type: input.type,
      occurredAt: input.occurredAt,
      endedAt: input.endedAt ?? null,
      payload: input.payload,
      groupId,
      createdBy: userId,
      updatedBy: userId,
      clientCreatedAt: now,
      serverUpdatedAt: null,
      seq: null,
      deletedAt: null,
    }));
    db.transaction((tx) => {
      for (const row of rows) {
        tx.insert(events).values(row).run();
        tx.insert(outbox)
          .values({
            entity: 'event',
            entityId: row.id,
            op: 'insert',
            body: JSON.stringify({
              id: row.id,
              household_id: row.householdId,
              baby_id: row.babyId,
              type: row.type,
              occurred_at: row.occurredAt,
              ended_at: row.endedAt,
              payload: row.payload,
              group_id: row.groupId,
              created_by: row.createdBy,
              updated_by: row.updatedBy,
              client_created_at: row.clientCreatedAt,
            }),
            createdAt: now,
          })
          .run();
      }
    });
    changed();
    return rows.map((row) => toEvent(row) as Event<unknown>);
  }

  return {
    insert(input: NewEvent): Event<unknown> {
      return insertAll([input], input.groupId ?? null)[0] as Event<unknown>;
    },

    /**
     * Several events logged as one thing, e.g. a bottle plus breast feed (SDD
     * 4.1): they share a new group id and commit together or not at all.
     */
    insertGroup(inputs: NewEvent[]): Event<unknown>[] {
      return insertAll(inputs, deps.newId(deps.now()));
    },

    patch(id: string, changes: EventChanges): Event<unknown> {
      const current = stored(id);
      if (current.deletedAt !== null) {
        throw new EventWriteError('deleted', `Event ${id} is deleted`);
      }
      const base = isRecord(current.payload) ? current.payload : {};
      const unset = changes.unset ?? [];
      if (unset.length > 0) {
        // Fields this version knows are the ones its schema keeps from the stored payload.
        const parsed = moduleFor(current.type).schema.safeParse(base);
        const known = parsed.success && isRecord(parsed.data) ? parsed.data : {};
        const unknownUnset = unset.filter((key) => !(key in known) && key in base);
        if (unknownUnset.length > 0) {
          throw new EventWriteError('unknown_fields', `Cannot remove ${unknownUnset.join(', ')}`);
        }
      }
      const merged: Record<string, unknown> = { ...base, ...(changes.payload ?? {}) };
      for (const key of unset) delete merged[key];
      validate(current.type, merged, Object.keys(changes.payload ?? {}));

      const now = deps.now();
      const { userId } = me();
      db.transaction((tx) => {
        tx.update(events)
          .set({
            payload: merged,
            updatedBy: userId,
            ...(changes.occurredAt !== undefined && { occurredAt: changes.occurredAt }),
            ...(changes.endedAt !== undefined && { endedAt: changes.endedAt }),
          })
          .where(eq(events.id, id))
          .run();
        tx.insert(outbox)
          .values(patchOp(id, userId, changes, now))
          .run();
      });
      changed();
      return toEvent(stored(id)) as Event<unknown>;
    },

    /**
     * Soft delete only (rule 7), of one event or several together (a mixed
     * feed's bottle and breast parts). Already deleted events are skipped. The
     * delete ops are held back from sync for the undo window.
     */
    softDelete(ids: string | readonly string[]): void {
      const live = (typeof ids === 'string' ? [ids] : ids)
        .map(stored)
        .filter((row) => row.deletedAt === null);
      if (live.length === 0) return;
      const now = deps.now();
      const { userId } = me();
      db.transaction((tx) => {
        for (const row of live) {
          tx.update(events)
            .set({ deletedAt: now, updatedBy: userId })
            .where(eq(events.id, row.id))
            .run();
          tx.insert(outbox)
            .values({
              entity: 'event',
              entityId: row.id,
              op: 'delete',
              body: JSON.stringify({ id: row.id, deleted_at: now, updated_by: userId }),
              createdAt: now,
              notBefore: now + UNDO_WINDOW_MS,
            })
            .run();
        }
      });
      changed();
    },

    /** Rows exactly as stored now, to hand back to `revert` for an undo. */
    snapshot(ids: readonly string[]): EventSnapshot[] {
      return ids.map((id) => ({ ...stored(id) }));
    },

    /**
     * Undo (P1-12): puts each event back exactly as in its snapshot.
     * - A delete still inside its undo window is cancelled: the held delete op
     *   is removed, so the server never sees it (there, delete is final).
     * - Changed fields are written back with one compensating patch, removing
     *   fields that were added, so every phone ends up where this one started.
     * Throws `not_undoable` if a delete's window has passed. All or nothing.
     */
    revert(snapshots: readonly EventSnapshot[]): void {
      const now = deps.now();
      const { userId } = me();
      db.transaction((tx) => {
        for (const before of snapshots) {
          const current = tx.select().from(events).where(eq(events.id, before.id)).get();
          if (!current) throw new EventWriteError('not_found', `No event ${before.id}`);

          if (current.deletedAt !== null && before.deletedAt === null) {
            const held = tx
              .select({ id: outbox.id })
              .from(outbox)
              .where(
                and(
                  eq(outbox.entityId, before.id),
                  eq(outbox.op, 'delete'),
                  gt(outbox.notBefore, now),
                ),
              )
              .all();
            if (held.length === 0) {
              throw new EventWriteError('not_undoable', `Delete of ${before.id} can't be undone`);
            }
            tx.delete(outbox)
              .where(
                inArray(
                  outbox.id,
                  held.map((op) => op.id),
                ),
              )
              .run();
            tx.update(events)
              .set({ deletedAt: null, updatedBy: before.updatedBy })
              .where(eq(events.id, before.id))
              .run();
          }

          const was = isRecord(before.payload) ? before.payload : {};
          const is = isRecord(current.payload) ? current.payload : {};
          const payload = Object.fromEntries(
            Object.entries(was).filter(
              ([key, value]) => JSON.stringify(is[key]) !== JSON.stringify(value),
            ),
          );
          const unset = Object.keys(is).filter((key) => !(key in was));
          const changes: EventChanges = {
            ...(Object.keys(payload).length > 0 && { payload }),
            ...(unset.length > 0 && { unset }),
            ...(current.occurredAt !== before.occurredAt && { occurredAt: before.occurredAt }),
            ...(current.endedAt !== before.endedAt && { endedAt: before.endedAt }),
          };
          if (Object.keys(changes).length === 0) continue;
          tx.update(events)
            .set({
              payload: before.payload,
              occurredAt: before.occurredAt,
              endedAt: before.endedAt,
              updatedBy: userId,
            })
            .where(eq(events.id, before.id))
            .run();
          tx.insert(outbox)
            .values(patchOp(before.id, userId, changes, now))
            .run();
        }
      });
      changed();
    },

    get(id: string): Event<unknown> | null {
      const row = db.select().from(events).where(eq(events.id, id)).get();
      return row ? toEvent(row) : null;
    },

    /**
     * Live events for the current baby, newest first by when they happened.
     * Events at the same instant are ordered by id so every phone that has the
     * same events shows them in the same order (SDD 5.5); insertion order would
     * differ between phones. Rows that can't be shown are left out, with a
     * warning (see toEvent).
     */
    list(): Event<unknown>[] {
      return db
        .select()
        .from(events)
        .where(and(eq(events.babyId, me().babyId), isNull(events.deletedAt)))
        .orderBy(desc(events.occurredAt), desc(events.id))
        .all()
        .map(toEvent)
        .filter((event): event is Event<unknown> => event !== null);
    },

    /** The user new events are logged as: the placeholder until sign in (P2). */
    currentUserId(): string {
      return me().userId;
    },

    /** Counts committed writes; a cheap change signal for React (useSyncExternalStore). */
    version(): number {
      return writes;
    },

    /** Called after every committed write. Returns an unsubscribe function. */
    subscribe(listener: () => void): () => void {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

export type EventsRepository = ReturnType<typeof createEventsRepository>;
