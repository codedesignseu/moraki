import { drizzle } from 'drizzle-orm/expo-sqlite';
import { migrate } from 'drizzle-orm/expo-sqlite/migrator';
import { getRandomBytes } from 'expo-crypto';
import { File } from 'expo-file-system';
import * as SecureStore from 'expo-secure-store';
import {
  defaultDatabaseDirectory,
  deleteDatabaseSync,
  openDatabaseSync,
  type SQLiteDatabase,
} from 'expo-sqlite';

import { newId } from '@/domain/ids';

import { keyPragma, openEncrypted, type DbFiles, type KeyStore } from './encryption';
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

const KEY_ITEM = 'moraki.db.key';

/**
 * The database key, in the keychain or Keystore. Readable after the first
 * unlock, so a reminder rescheduled in the background can still open the
 * database; never synced off the device by iCloud Keychain.
 */
const keys: KeyStore = {
  get: () => SecureStore.getItem(KEY_ITEM),
  set: (key) =>
    SecureStore.setItem(KEY_ITEM, key, {
      keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
    }),
};

const files: DbFiles<SQLiteDatabase> = {
  exists: (name) => new File(`file://${defaultDatabaseDirectory}/${name}`).exists,
  pathOf: (name) => `${defaultDatabaseDirectory}/${name}`,
  open: (name, key) => {
    const db = openDatabaseSync(name);
    if (key !== null) db.execSync(keyPragma(key));
    return db;
  },
  remove: (name) => deleteDatabaseSync(name),
};

const hex = (bytes: Uint8Array) =>
  Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');

/**
 * Opens the on-device database, encrypted with SQLCipher (P5-03, ADR-011).
 * SQLite is the source of truth for the UI (rule 1).
 */
export function openLocalDb() {
  const { db } = openEncrypted(files, keys, () => hex(getRandomBytes(32)));
  return drizzle(db, { schema });
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
