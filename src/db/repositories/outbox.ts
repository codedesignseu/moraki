import { asc, inArray, isNull, lte, or, sql } from 'drizzle-orm';

import type { SyncDb } from '../identity';
import { outbox, syncErrors } from '../schema';

/** SDD 5.2: at most 100 ops per push_events call. */
export const PUSH_BATCH = 100;

export type OutboxRow = typeof outbox.$inferSelect;
export type SyncErrorRow = typeof syncErrors.$inferSelect;

/**
 * The queue of local writes waiting for the server (SDD 4.4), and the ops the
 * server refused for good. Ops leave the outbox only when the server has
 * answered for them: applied or ignored means done, rejected means it moves
 * to sync_errors, and anything else stays to be tried again.
 */
export function createOutboxRepository(db: SyncDb) {
  const listeners = new Set<() => void>();
  let changes = 0;

  function changed() {
    changes += 1;
    for (const listener of listeners) listener();
  }

  return {
    /** The oldest ops whose hold (P1-12's undo window) has passed. */
    due(now: number, limit: number = PUSH_BATCH): OutboxRow[] {
      return db
        .select()
        .from(outbox)
        .where(or(isNull(outbox.notBefore), lte(outbox.notBefore, now)))
        .orderBy(asc(outbox.id))
        .limit(limit)
        .all();
    },

    /** Everything still waiting, held ops included: the count P2-13 shows. */
    pending(): number {
      return (
        db
          .select({ n: sql<number>`count(*)` })
          .from(outbox)
          .get()?.n ?? 0
      );
    },

    /** When the earliest held op becomes due, so the engine can sleep until then. */
    nextDueAt(now: number): number | null {
      const row = db
        .select({ at: sql<number>`min(${outbox.notBefore})` })
        .from(outbox)
        .where(sql`${outbox.notBefore} > ${now}`)
        .get();
      return row?.at ?? null;
    },

    /** The server is done with these: applied, or nothing left to do. */
    done(ids: readonly number[]): void {
      if (ids.length === 0) return;
      db.delete(outbox)
        .where(inArray(outbox.id, [...ids]))
        .run();
      changed();
    },

    /** Never going to work: out of the queue, into the list P2-13 shows. */
    reject(rows: readonly { row: OutboxRow; reason: string }[], now: number): void {
      if (rows.length === 0) return;
      db.transaction((tx) => {
        for (const { row, reason } of rows) {
          tx.insert(syncErrors)
            .values({
              entity: row.entity,
              entityId: row.entityId,
              op: row.op,
              body: row.body,
              reason,
              attempts: row.attempts + 1,
              failedAt: now,
            })
            .run();
        }
        tx.delete(outbox)
          .where(
            inArray(
              outbox.id,
              rows.map(({ row }) => row.id),
            ),
          )
          .run();
      });
      changed();
    },

    /** A try that didn't reach the server, or one the server put off. */
    noteAttempt(ids: readonly number[], error: string | null): void {
      if (ids.length === 0) return;
      db.update(outbox)
        .set({ attempts: sql`${outbox.attempts} + 1`, lastError: error })
        .where(inArray(outbox.id, [...ids]))
        .run();
      changed();
    },

    errors(): SyncErrorRow[] {
      return db.select().from(syncErrors).orderBy(asc(syncErrors.failedAt)).all();
    },

    /** Counts changes; a cheap signal for React (useSyncExternalStore). */
    version(): number {
      return changes;
    },

    subscribe(listener: () => void): () => void {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

export type OutboxRepository = ReturnType<typeof createOutboxRepository>;
