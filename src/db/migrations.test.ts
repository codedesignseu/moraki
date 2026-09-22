/**
 * @jest-environment node
 */
/// <reference types="node" />
import { readFileSync, mkdtempSync, copyFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/sql-js';
import { migrate } from 'drizzle-orm/sql-js/migrator';
import initSqlJs, { type Database, type SqlJsStatic } from 'sql.js';

import { META_KEYS } from './meta';
import * as schema from './schema';

// The app runs these migrations through the expo-sqlite migrator; tests run the
// same SQL files through Drizzle's sql.js migrator against real SQLite (WASM).
const MIGRATIONS = join(__dirname, 'migrations');

type JournalEntry = { idx: number; tag: string };
const journal = JSON.parse(readFileSync(join(MIGRATIONS, 'meta/_journal.json'), 'utf8')) as {
  entries: JournalEntry[];
  [key: string]: unknown;
};

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

let SQL: SqlJsStatic;
beforeAll(async () => {
  SQL = await initSqlJs();
});

/** A migrations folder holding only the first `count` migrations: an older app version. */
function folderUpTo(count: number): string {
  const dir = mkdtempSync(join(tmpdir(), 'moraki-migrations-'));
  mkdirSync(join(dir, 'meta'));
  const entries = journal.entries.slice(0, count);
  writeFileSync(join(dir, 'meta/_journal.json'), JSON.stringify({ ...journal, entries }));
  for (const { tag } of entries) {
    copyFileSync(join(MIGRATIONS, `${tag}.sql`), join(dir, `${tag}.sql`));
  }
  return dir;
}

function open(sqlite: Database = new SQL.Database()) {
  return { sqlite, db: drizzle(sqlite, { schema }) };
}

function tables(sqlite: Database): string[] {
  const [result] = sqlite.exec(
    "select name from sqlite_master where type = 'table' and name not like 'sqlite_%' and name not like '__drizzle%' order by name",
  );
  return (result?.values ?? []).map(([name]) => String(name));
}

function columns(sqlite: Database, table: string): string[] {
  const [result] = sqlite.exec(`pragma table_info(${table})`);
  return (result?.values ?? []).map((row) => String(row[1]));
}

function appliedCount(sqlite: Database): number {
  const [result] = sqlite.exec('select count(*) from __drizzle_migrations');
  return Number(result?.values[0]?.[0]);
}

function metaValue(db: ReturnType<typeof open>['db'], key: string): string | undefined {
  return db.select().from(schema.meta).where(eq(schema.meta.key, key)).get()?.value;
}

const anEvent = {
  id: '01890a5d-ac96-774b-bcce-b302099a8057',
  householdId: 'h',
  babyId: 'b',
  type: 'feed_bottle',
  occurredAt: Date.UTC(2026, 9, 25, 0, 30),
  payload: { ml: 90, milk: 'formula' },
  createdBy: 'u',
  updatedBy: 'u',
  clientCreatedAt: Date.UTC(2026, 9, 25, 0, 31),
};

describe('local migrations: fresh install', () => {
  it('creates every table with the SDD 4.2 / 4.4 columns', () => {
    const { sqlite, db } = open();
    migrate(db, { migrationsFolder: MIGRATIONS });

    expect(tables(sqlite)).toEqual([
      'babies',
      'events',
      'memberships',
      'meta',
      'outbox',
      'sync_errors',
    ]);
    expect(columns(sqlite, 'events')).toEqual([
      'id',
      'household_id',
      'baby_id',
      'type',
      'occurred_at',
      'ended_at',
      'payload',
      'group_id',
      'created_by',
      'updated_by',
      'client_created_at',
      'server_updated_at',
      'seq',
      'deleted_at',
    ]);
    expect(columns(sqlite, 'outbox')).toEqual([
      'id',
      'entity',
      'entity_id',
      'op',
      'body',
      'attempts',
      'last_error',
      'created_at',
      'not_before',
    ]);
    expect(columns(sqlite, 'meta')).toEqual(['key', 'value']);
    expect(appliedCount(sqlite)).toBe(journal.entries.length);
  });

  it('creates distinct UUID v4 placeholder ids for household, baby and user', () => {
    const { db } = open();
    migrate(db, { migrationsFolder: MIGRATIONS });

    const ids = [META_KEYS.localHouseholdId, META_KEYS.localBabyId, META_KEYS.localUserId].map(
      (key) => metaValue(db, key),
    );
    for (const id of ids) expect(id).toMatch(UUID_V4);
    expect(new Set(ids).size).toBe(3);
  });

  it('stores an event payload as JSON text and reads it back as the same object', () => {
    const { sqlite, db } = open();
    migrate(db, { migrationsFolder: MIGRATIONS });
    db.insert(schema.events).values(anEvent).run();

    const [raw] = sqlite.exec('select payload, typeof(payload) from events');
    expect(raw?.values[0]).toEqual(['{"ml":90,"milk":"formula"}', 'text']);
    expect(db.select().from(schema.events).get()?.payload).toEqual(anEvent.payload);
  });

  it('indexes live events by baby and time', () => {
    const { sqlite, db } = open();
    migrate(db, { migrationsFolder: MIGRATIONS });
    const [result] = sqlite.exec(
      "select sql from sqlite_master where type = 'index' and name = 'events_time'",
    );
    expect(String(result?.values[0]?.[0])).toMatch(/deleted_at.* is null/i);
  });
});

describe('local migrations: upgrade', () => {
  // Every earlier schema version upgrades to the latest with its data intact.
  // New migrations are covered automatically as the journal grows.
  const priorVersions = journal.entries.slice(1).map((entry) => [entry.idx, entry.tag] as const);

  it.each(priorVersions)('upgrades a database with %i migration(s) applied (next: %s)', (count) => {
    const { sqlite, db } = open();
    migrate(db, { migrationsFolder: folderUpTo(count) });
    expect(appliedCount(sqlite)).toBe(count);
    db.insert(schema.events).values(anEvent).run();

    // Reopen the same file, as the new app version would after an update.
    const upgraded = open(new SQL.Database(sqlite.export()));
    migrate(upgraded.db, { migrationsFolder: MIGRATIONS });

    expect(appliedCount(upgraded.sqlite)).toBe(journal.entries.length);
    expect(upgraded.db.select().from(schema.events).all()).toEqual([
      {
        ...anEvent,
        endedAt: null,
        groupId: null,
        serverUpdatedAt: null,
        seq: null,
        deletedAt: null,
      },
    ]);
    expect(metaValue(upgraded.db, META_KEYS.localBabyId)).toMatch(UUID_V4);
  });

  it('keeps placeholder ids that already exist', () => {
    const { sqlite, db } = open();
    migrate(db, { migrationsFolder: folderUpTo(1) });
    db.insert(schema.meta).values({ key: META_KEYS.localBabyId, value: 'kept' }).run();

    const upgraded = open(new SQL.Database(sqlite.export()));
    migrate(upgraded.db, { migrationsFolder: MIGRATIONS });
    expect(metaValue(upgraded.db, META_KEYS.localBabyId)).toBe('kept');
  });

  it('is a no-op on a database that is already current, so ids stay stable', () => {
    const { sqlite, db } = open();
    migrate(db, { migrationsFolder: MIGRATIONS });
    const before = db.select().from(schema.meta).all();

    migrate(db, { migrationsFolder: MIGRATIONS });
    expect(appliedCount(sqlite)).toBe(journal.entries.length);
    expect(db.select().from(schema.meta).all()).toEqual(before);
  });
});

describe('expo migrations bundle', () => {
  it('imports every migration in the journal', () => {
    const bundle = readFileSync(join(MIGRATIONS, 'migrations.js'), 'utf8');
    for (const { idx, tag } of journal.entries) {
      const key = `m${String(idx).padStart(4, '0')}`;
      expect(bundle).toContain(`import ${key} from './${tag}.sql';`);
    }
  });
});
