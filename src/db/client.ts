import { drizzle } from 'drizzle-orm/expo-sqlite';
import { migrate } from 'drizzle-orm/expo-sqlite/migrator';
import { getRandomBytes } from 'expo-crypto';
import { openDatabaseSync } from 'expo-sqlite';

import { newId } from '@/domain/ids';

import migrations from './migrations/migrations';
import type { AppRepositories } from './react';
import { adoptHousehold, localOnlyCount } from './adoptHousehold';
import { readLinkedIdentity } from './identity';
import { createResetPhone } from './resetPhone';
import { createDevicePrefsRepository } from './repositories/devicePrefs';
import { createCaregiversRepository } from './repositories/caregivers';
import { createOutboxRepository } from './repositories/outbox';
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

/** Opens the database, brings it to the latest schema, and returns the repositories. */
export async function openAppDatabase(): Promise<AppRepositories> {
  const db = openLocalDb();
  await migrateLocalDb(db);
  const repositories = {
    events: createAppEventsRepository(db),
    devicePrefs: createDevicePrefsRepository(db),
    outbox: createOutboxRepository(db),
    caregivers: createCaregiversRepository(db),
  };
  return {
    ...repositories,
    linked: () => readLinkedIdentity(db),
    localOnly: () => localOnlyCount(db),
    adopt: (target, now) => adoptHousehold(db, target, now),
    resetPhone: createResetPhone(db, repositories, () =>
      newId(Date.now(), () => getRandomBytes(16)),
    ),
  };
}
