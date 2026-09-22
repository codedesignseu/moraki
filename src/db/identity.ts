import { inArray } from 'drizzle-orm';
import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';

import { META_KEYS } from './meta';
import type * as schema from './schema';
import { meta } from './schema';

/** Any synchronous Drizzle SQLite database on our schema: expo-sqlite on device, sql.js in tests. */
export type SyncDb = BaseSQLiteDatabase<'sync', unknown, typeof schema>;

export type Identity = { householdId: string; babyId: string; userId: string };

/**
 * The household, baby and user every new event belongs to. Before sign in these
 * are the placeholders migration 0001 created; once sync exists (P2) the real
 * household and user ids in meta take precedence. There is one baby for now.
 */
export function readIdentity(db: SyncDb): Identity {
  const rows = db
    .select()
    .from(meta)
    .where(
      inArray(meta.key, [
        META_KEYS.householdId,
        META_KEYS.userId,
        META_KEYS.localHouseholdId,
        META_KEYS.localBabyId,
        META_KEYS.localUserId,
      ]),
    )
    .all();
  const value = (key: string) => rows.find((row) => row.key === key)?.value;

  const householdId = value(META_KEYS.householdId) ?? value(META_KEYS.localHouseholdId);
  const userId = value(META_KEYS.userId) ?? value(META_KEYS.localUserId);
  const babyId = value(META_KEYS.localBabyId);
  if (!householdId || !userId || !babyId) {
    throw new Error('Local identity missing from meta: run migrations first');
  }
  return { householdId, babyId, userId };
}
