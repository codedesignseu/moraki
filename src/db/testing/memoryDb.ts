/// <reference types="node" />
// Test-only: a migrated in-memory SQLite database (sql.js, real SQLite in WASM)
// using the same migration files as the app. Never imported by app code.
import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { drizzle } from 'drizzle-orm/sql-js';
import { migrate } from 'drizzle-orm/sql-js/migrator';
import initSqlJs, { type Database, type SqlJsStatic } from 'sql.js';

import { newId } from '@/domain/ids';

import type { SyncDb } from '../identity';
import * as schema from '../schema';

let sqlJs: Promise<SqlJsStatic> | undefined;

function loadSqlJs(): Promise<SqlJsStatic> {
  // Hand sql.js its WASM directly so it works under any Jest environment.
  sqlJs ??= initSqlJs({
    wasmBinary: readFileSync(require.resolve('sql.js/dist/sql-wasm.wasm')).buffer as ArrayBuffer,
  });
  return sqlJs;
}

export type MemoryDb = { sqlite: Database; db: SyncDb };

/** A fresh, fully migrated database. Pass `bytes` to reopen a saved one, as after an app kill. */
export async function createMemoryDb(bytes?: Uint8Array): Promise<MemoryDb> {
  const SQL = await loadSqlJs();
  const sqlite = new SQL.Database(bytes);
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: join(__dirname, '../migrations') });
  return { sqlite, db };
}

/** Deterministic clock and real UUID v7 ids for repository tests. */
export function testDeps(start = Date.UTC(2026, 9, 25, 9, 0)) {
  let now = start;
  return {
    now: () => now,
    newId: (at: number) => newId(at, () => new Uint8Array(randomBytes(16))),
    advance(ms: number) {
      now += ms;
    },
    set(ms: number) {
      now = ms;
    },
  };
}
