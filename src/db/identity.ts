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

/**
 * The real household and user from sign in, once P2-11 has linked this phone
 * (SDD 4.4's meta keys). Null while the phone is still on the placeholder ids
 * migration 0001 seeded: its entries belong to no server household yet, so
 * pushing them would only be refused (P2-F4).
 */
export function readLinkedIdentity(db: SyncDb): { householdId: string; userId: string } | null {
  const rows = db
    .select()
    .from(meta)
    .where(inArray(meta.key, [META_KEYS.householdId, META_KEYS.userId]))
    .all();
  const value = (key: string) => rows.find((row) => row.key === key)?.value;
  const householdId = value(META_KEYS.householdId);
  const userId = value(META_KEYS.userId);
  return householdId && userId ? { householdId, userId } : null;
}
