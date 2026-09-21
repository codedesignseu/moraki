import { sql } from 'drizzle-orm';
import { index, integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core';

// Local mirror of the server tables in SDD 4.2, plus outbox and meta (SDD 4.4).
// Times are UTC epoch milliseconds (rule 5). Ids are UUID text. No foreign keys:
// pull can deliver an event before its baby, and the server enforces integrity.

export const babies = sqliteTable('babies', {
  id: text('id').primaryKey(),
  householdId: text('household_id').notNull(),
  name: text('name').notNull(),
  bornAt: integer('born_at').notNull(),
  birthWeightG: integer('birth_weight_g'),
  birthLengthMm: integer('birth_length_mm'),
  headCircMm: integer('head_circ_mm'),
  updatedAt: integer('updated_at').notNull(),
  deletedAt: integer('deleted_at'),
});

export const memberships = sqliteTable(
  'memberships',
  {
    householdId: text('household_id').notNull(),
    userId: text('user_id').notNull(),
    role: text('role', { enum: ['owner', 'caregiver', 'viewer'] }).notNull(),
    displayName: text('display_name').notNull(),
    relation: text('relation', {
      enum: ['mother', 'father', 'grandparent', 'caregiver', 'other'],
    }),
    joinedAt: integer('joined_at').notNull(),
  },
  (t) => [primaryKey({ columns: [t.householdId, t.userId] })],
);

export const events = sqliteTable(
  'events',
  {
    id: text('id').primaryKey(),
    householdId: text('household_id').notNull(),
    babyId: text('baby_id').notNull(),
    type: text('type').notNull(),
    occurredAt: integer('occurred_at').notNull(),
    endedAt: integer('ended_at'),
    // JSON text. Validated by the activity module's Zod schema on write and on
    // read (rule 6); the column itself only guarantees well-formed JSON.
    payload: text('payload', { mode: 'json' }).$type<unknown>().notNull().default({}),
    groupId: text('group_id'),
    createdBy: text('created_by').notNull(),
    updatedBy: text('updated_by').notNull(),
    clientCreatedAt: integer('client_created_at').notNull(),
    // Server-assigned; null until the event has been through a push or pull.
    serverUpdatedAt: integer('server_updated_at'),
    seq: integer('seq'),
    deletedAt: integer('deleted_at'),
  },
  (t) => [
    index('events_time')
      .on(t.babyId, t.occurredAt)
      .where(sql`${t.deletedAt} is null`),
  ],
);

export const outbox = sqliteTable('outbox', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  entity: text('entity', { enum: ['event', 'baby'] }).notNull(),
  entityId: text('entity_id').notNull(),
  op: text('op', { enum: ['insert', 'patch', 'delete'] }).notNull(),
  body: text('body').notNull(),
  attempts: integer('attempts').notNull().default(0),
  lastError: text('last_error'),
  createdAt: integer('created_at').notNull(),
});

export const meta = sqliteTable('meta', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
});
