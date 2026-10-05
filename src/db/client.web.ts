// WEB PREVIEW ONLY (P1-F7). Metro resolves `@/db/client` to this file for web
// bundles and to client.ts for iOS and Android, so nothing here, sql.js
// included, is ever part of a device build. expo-sqlite can't run in a browser
// dev server (SDD 11 notes the same for tests), so web preview gets an
// in-memory SQLite stand-in: same schema, same migrations bundle, same
// migrator and the same events repository as the device; only the database
// handle differs. Nothing is saved: a reload starts empty.
import { drizzle } from 'drizzle-orm/sql-js';
import { migrate } from 'drizzle-orm/expo-sqlite/migrator';
import { getRandomBytes } from 'expo-crypto';
// Pure-JavaScript build of SQLite: no .wasm file to serve, no Node APIs.
import initSqlJs from 'sql.js/dist/sql-asm.js';

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

/** Opens a fresh in-memory database, migrates it, and returns the repositories. */
export async function openAppDatabase(): Promise<AppRepositories> {
  console.warn(
    '[moraki] Web preview: using an in-memory stand-in database, not expo-sqlite. ' +
      'Entries are lost on reload and nothing here tests real device storage.',
  );
  const SQL = await initSqlJs();
  const db = drizzle(new SQL.Database(), { schema });
  // The expo migrator only uses the database's dialect and session, which the
  // sql.js driver shares, so this runs the device's exact migration path.
  await migrate(db as unknown as Parameters<typeof migrate>[0], migrations);
  const repositories = {
    events: createEventsRepository(db, {
      now: Date.now,
      newId: (now) => newId(now, () => getRandomBytes(16)),
    }),
    devicePrefs: createDevicePrefsRepository(db),
    outbox: createOutboxRepository(db),
    caregivers: createCaregiversRepository(db),
  };
  return {
    ...repositories,
    resetPhone: createResetPhone(db, repositories, () =>
      newId(Date.now(), () => getRandomBytes(16)),
    ),
    linked: () => readLinkedIdentity(db),
    localOnly: () => localOnlyCount(db),
    adopt: (target, now) => adoptHousehold(db, target, now),
  };
}
