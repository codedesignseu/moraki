import { and, eq, sql } from 'drizzle-orm';

import { readIdentity, readLinkedIdentity, type SyncDb } from './identity';
import { META_KEYS } from './meta';
import { babies, events, meta, outbox } from './schema';

/** The household this phone is joining, as `pref.account_household` records it. */
export type AdoptionTarget = {
  userId: string;
  householdId: string;
  babyId: string;
  babyName: string;
};

export type Adoption = { events: number; ops: number };

/** The ids a body carries; only entries still on the placeholders are rewritten. */
function rewriteBody(
  body: string,
  from: { household: string; baby: string; user: string },
  to: AdoptionTarget,
) {
  const parsed = JSON.parse(body) as Record<string, unknown>;
  const swap = (key: string, was: string, now: string) => {
    if (parsed[key] === was) parsed[key] = now;
  };
  swap('household_id', from.household, to.householdId);
  swap('baby_id', from.baby, to.babyId);
  swap('created_by', from.user, to.userId);
  swap('updated_by', from.user, to.userId);
  return JSON.stringify(parsed);
}

/**
 * Moves everything this phone logged before it had an account into the
 * household it now belongs to (P2-11), in one transaction:
 *
 * - entries still carrying the placeholder ids migration 0001 seeded are
 *   rewritten to the household, its baby and this account (P2-F4, D2);
 * - the outbox ops waiting for those entries are rewritten the same way, so
 *   what is sent matches what is stored;
 * - the baby is stored locally, since a pull brings events only (P2-F11);
 * - `meta` finally names the real household and user, which is what opens the
 *   gate on sending, reading and listening (P2-08, P2-09, P2-10).
 *
 * Entries that came from the server are left alone: they already belong to
 * the household. Running it twice changes nothing the second time.
 */
export function adoptHousehold(db: SyncDb, target: AdoptionTarget, now: number): Adoption {
  const linked = readLinkedIdentity(db);
  // Already done: the phone belongs to this household, and its entries with it.
  if (linked?.householdId === target.householdId && linked.userId === target.userId) {
    return { events: 0, ops: 0 };
  }
  const before = readIdentity(db);
  const from = { household: before.householdId, baby: before.babyId, user: before.userId };
  let moved = 0;
  let ops = 0;

  db.transaction((tx) => {
    const mine = tx
      .select()
      .from(events)
      .where(and(eq(events.householdId, from.household), eq(events.babyId, from.baby)))
      .all();

    for (const row of mine) {
      tx.update(events)
        .set({
          householdId: target.householdId,
          babyId: target.babyId,
          createdBy: row.createdBy === from.user ? target.userId : row.createdBy,
          updatedBy: row.updatedBy === from.user ? target.userId : row.updatedBy,
        })
        .where(eq(events.id, row.id))
        .run();
      moved += 1;
    }

    for (const op of tx.select().from(outbox).all()) {
      const body = rewriteBody(op.body, from, target);
      if (body === op.body) continue;
      tx.update(outbox).set({ body }).where(eq(outbox.id, op.id)).run();
      ops += 1;
    }

    tx.insert(babies)
      .values({
        id: target.babyId,
        householdId: target.householdId,
        name: target.babyName,
        bornAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: babies.id,
        set: { householdId: target.householdId, name: target.babyName },
      })
      .run();

    for (const [key, value] of [
      [META_KEYS.householdId, target.householdId],
      [META_KEYS.userId, target.userId],
      [META_KEYS.localBabyId, target.babyId],
    ] as const) {
      tx.insert(meta)
        .values({ key, value })
        .onConflictDoUpdate({ target: meta.key, set: { value } })
        .run();
    }
  });

  return { events: moved, ops };
}

/** How many entries a phone would take with it, for the question it asks first. */
export function localOnlyCount(db: SyncDb): number {
  const identity = readIdentity(db);
  return (
    db
      .select({ n: sql<number>`count(*)` })
      .from(events)
      .where(and(eq(events.householdId, identity.householdId), eq(events.babyId, identity.babyId)))
      .get()?.n ?? 0
  );
}
