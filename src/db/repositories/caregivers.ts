import { asc, eq } from 'drizzle-orm';

import { readIdentity, type SyncDb } from '../identity';
import { memberships } from '../schema';

export type Caregiver = typeof memberships.$inferSelect;

/**
 * Who else is in this household (SDD 4.4 mirrors memberships). Names come
 * from the server, so entries can read as the person who logged them rather
 * than as an id, and Settings can list the household (P2-12).
 */
export function createCaregiversRepository(db: SyncDb) {
  const listeners = new Set<() => void>();
  let changes = 0;

  return {
    list(): Caregiver[] {
      const { householdId } = readIdentity(db);
      return db
        .select()
        .from(memberships)
        .where(eq(memberships.householdId, householdId))
        .orderBy(asc(memberships.joinedAt))
        .all();
    },

    /** Names by user id, for entry rows. */
    names(): Map<string, string> {
      return new Map(this.list().map((row) => [row.userId, row.displayName]));
    },

    /** Replaces what this phone knows about a household's caregivers. */
    replace(householdId: string, rows: readonly Caregiver[]): void {
      db.transaction((tx) => {
        tx.delete(memberships).where(eq(memberships.householdId, householdId)).run();
        for (const row of rows) tx.insert(memberships).values(row).run();
      });
      changes += 1;
      for (const listener of listeners) listener();
    },

    version(): number {
      return changes;
    },

    subscribe(listener: () => void): () => void {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

export type CaregiversRepository = ReturnType<typeof createCaregiversRepository>;
