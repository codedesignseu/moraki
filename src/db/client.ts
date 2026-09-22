import { drizzle } from 'drizzle-orm/expo-sqlite';
import { migrate } from 'drizzle-orm/expo-sqlite/migrator';
import { getRandomBytes } from 'expo-crypto';
import { openDatabaseSync } from 'expo-sqlite';

import { newId } from '@/domain/ids';

import migrations from './migrations/migrations';
import { createEventsRepository } from './repositories/events';
import * as schema from './schema';

const DB_NAME = 'moraki.db';

/** Opens the on-device database. SQLite is the source of truth for the UI (rule 1). */
export function openLocalDb() {
  return drizzle(openDatabaseSync(DB_NAME), { schema });
}

export type LocalDb = ReturnType<typeof openLocalDb>;

/**
 * Brings the database to the latest schema: creates it on a fresh install,
 * applies only the new migrations on an upgrade, and does nothing if current.
 */
export function migrateLocalDb(db: LocalDb): Promise<void> {
  return migrate(db, migrations);
}

/** The app's events repository: wall clock, and UUID v7 ids from the OS secure random source. */
export function createAppEventsRepository(db: LocalDb) {
  return createEventsRepository(db, {
    now: Date.now,
    newId: (now) => newId(now, () => getRandomBytes(16)),
  });
}
