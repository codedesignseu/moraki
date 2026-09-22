import { and, desc, eq, isNull } from 'drizzle-orm';

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
};

export class EventWriteError extends Error {
  constructor(
    readonly reason:
      'unknown_type' | 'invalid_payload' | 'unknown_fields' | 'not_found' | 'deleted',
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

/**
 * The only way the app writes events (rule 2): every write stores the event and
 * its outbox op in one transaction, so both commit or neither does. Outbox
 * bodies use the server's column names, ready for push_events (SDD 5.2).
 */
export function createEventsRepository(db: SyncDb, deps: EventsRepositoryDeps) {
  const listeners = new Set<() => void>();
  let identity: Identity | undefined;
  const me = () => (identity ??= readIdentity(db));

  function changed() {
    for (const listener of listeners) listener();
  }

  function stored(id: string): EventRow {
    const row = db.select().from(events).where(eq(events.id, id)).get();
    if (!row) throw new EventWriteError('not_found', `No event ${id}`);
    return row;
  }

  return {
    insert(input: NewEvent): Event<unknown> {
      const writtenKeys = isRecord(input.payload) ? Object.keys(input.payload) : [];
      validate(input.type, input.payload, writtenKeys);
      const now = deps.now();
      const { householdId, babyId, userId } = me();
      const row: EventRow = {
        id: deps.newId(now),
        householdId,
        babyId,
        type: input.type,
        occurredAt: input.occurredAt,
        endedAt: input.endedAt ?? null,
        payload: input.payload,
        groupId: input.groupId ?? null,
        createdBy: userId,
        updatedBy: userId,
        clientCreatedAt: now,
        serverUpdatedAt: null,
        seq: null,
        deletedAt: null,
      };
      db.transaction((tx) => {
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
      });
      changed();
      return toEvent(row) as Event<unknown>;
    },

    patch(id: string, changes: EventChanges): Event<unknown> {
      const current = stored(id);
      if (current.deletedAt !== null) {
        throw new EventWriteError('deleted', `Event ${id} is deleted`);
      }
      const base = isRecord(current.payload) ? current.payload : {};
      const payload = changes.payload ? { ...base, ...changes.payload } : base;
      validate(current.type, payload, Object.keys(changes.payload ?? {}));

      const now = deps.now();
      const { userId } = me();
      const update = {
        payload,
        updatedBy: userId,
        ...(changes.occurredAt !== undefined && { occurredAt: changes.occurredAt }),
        ...(changes.endedAt !== undefined && { endedAt: changes.endedAt }),
      };
      db.transaction((tx) => {
        tx.update(events).set(update).where(eq(events.id, id)).run();
        tx.insert(outbox)
          .values({
            entity: 'event',
            entityId: id,
            op: 'patch',
            body: JSON.stringify({
              id,
              updated_by: userId,
              ...(changes.payload && { payload: changes.payload }),
              ...(changes.occurredAt !== undefined && { occurred_at: changes.occurredAt }),
              ...(changes.endedAt !== undefined && { ended_at: changes.endedAt }),
            }),
            createdAt: now,
          })
          .run();
      });
      changed();
      return toEvent(stored(id)) as Event<unknown>;
    },

    /** Soft delete only (rule 7). Deleting an already deleted event does nothing. */
    softDelete(id: string): void {
      const current = stored(id);
      if (current.deletedAt !== null) return;
      const now = deps.now();
      const { userId } = me();
      db.transaction((tx) => {
        tx.update(events).set({ deletedAt: now, updatedBy: userId }).where(eq(events.id, id)).run();
        tx.insert(outbox)
          .values({
            entity: 'event',
            entityId: id,
            op: 'delete',
            body: JSON.stringify({ id, deleted_at: now, updated_by: userId }),
            createdAt: now,
          })
          .run();
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

    /** Called after every committed write. Returns an unsubscribe function. */
    subscribe(listener: () => void): () => void {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

export type EventsRepository = ReturnType<typeof createEventsRepository>;
