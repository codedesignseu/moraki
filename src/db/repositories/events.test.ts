import { eq } from 'drizzle-orm';

import { META_KEYS } from '../meta';
import { events, meta, outbox } from '../schema';
import { createMemoryDb, testDeps, type MemoryDb } from '../testing/memoryDb';
import type { EventWriteError } from './events';
import { createEventsRepository } from './events';

const V7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const bottle = { type: 'feed_bottle' as const, occurredAt: Date.UTC(2026, 9, 25, 8, 30) };

let mem: MemoryDb;
let deps: ReturnType<typeof testDeps>;
let repo: ReturnType<typeof createEventsRepository>;

beforeEach(async () => {
  mem = await createMemoryDb();
  deps = testDeps();
  repo = createEventsRepository(mem.db, deps);
});

const count = (table: 'events' | 'outbox') =>
  Number(mem.sqlite.exec(`select count(*) from ${table}`)[0]?.values[0]?.[0]);

/** Makes every insert (or update) on a table fail inside SQLite, mid-transaction. */
function failOn(table: 'events' | 'outbox', op: 'INSERT' | 'UPDATE') {
  mem.sqlite.run(
    `CREATE TRIGGER fail_${table}_${op} BEFORE ${op} ON ${table} BEGIN SELECT RAISE(ABORT, 'forced failure'); END`,
  );
}

function outboxRows() {
  return mem.db
    .select()
    .from(outbox)
    .all()
    .map((row) => ({ ...row, body: JSON.parse(row.body) as Record<string, unknown> }));
}

describe('insert', () => {
  it('writes the event and one outbox op with the server column names', () => {
    const event = repo.insert({ ...bottle, payload: { ml: 90, milk: 'formula' } });
    const local = Object.fromEntries(
      mem.db
        .select()
        .from(meta)
        .all()
        .map((r) => [r.key, r.value]),
    );

    expect(event.id).toMatch(V7);
    expect(event).toMatchObject({
      householdId: local[META_KEYS.localHouseholdId],
      babyId: local[META_KEYS.localBabyId],
      createdBy: local[META_KEYS.localUserId],
      clientCreatedAt: deps.now(),
      payload: { ml: 90, milk: 'formula' },
    });
    expect(outboxRows()).toEqual([
      expect.objectContaining({
        entity: 'event',
        entityId: event.id,
        op: 'insert',
        attempts: 0,
        body: expect.objectContaining({
          id: event.id,
          household_id: event.householdId,
          baby_id: event.babyId,
          occurred_at: bottle.occurredAt,
          payload: { ml: 90, milk: 'formula' },
        }),
      }),
    ]);
  });

  it('rolls the event back when the outbox write fails', () => {
    failOn('outbox', 'INSERT');
    expect(() => repo.insert({ ...bottle, payload: { ml: 90, milk: 'formula' } })).toThrow(
      'forced failure',
    );
    expect(count('events')).toBe(0);
    expect(count('outbox')).toBe(0);
  });

  it('writes no outbox op when the event write fails', () => {
    failOn('events', 'INSERT');
    expect(() => repo.insert({ ...bottle, payload: { ml: 90, milk: 'formula' } })).toThrow();
    expect(count('outbox')).toBe(0);
  });

  it.each([
    ['an out-of-range value', { ml: 500, milk: 'formula' }, 'invalid_payload'],
    ['an unknown field', { ml: 90, milk: 'formula', mll: 90 }, 'unknown_fields'],
  ])('rejects %s and writes nothing', (_name, payload, reason) => {
    expect(() => repo.insert({ ...bottle, payload })).toThrow(
      expect.objectContaining({ reason }) as EventWriteError,
    );
    expect(count('events')).toBe(0);
    expect(count('outbox')).toBe(0);
  });

  it('rejects a type with no activity module', () => {
    expect(() => repo.insert({ ...bottle, type: 'bath' as never, payload: {} })).toThrow(
      expect.objectContaining({ reason: 'unknown_type' }) as EventWriteError,
    );
  });
});

describe('patch', () => {
  it('merges the change, updates the row and queues only the changed fields', () => {
    const { id } = repo.insert({ ...bottle, payload: { ml: 90, milk: 'formula' } });
    deps.advance(60_000);
    const patched = repo.patch(id, { payload: { ml: 120 }, endedAt: bottle.occurredAt + 600_000 });

    expect(patched.payload).toEqual({ ml: 120, milk: 'formula' });
    expect(patched.endedAt).toBe(bottle.occurredAt + 600_000);
    expect(outboxRows()[1]).toEqual(
      expect.objectContaining({
        op: 'patch',
        entityId: id,
        body: {
          id,
          updated_by: patched.updatedBy,
          payload: { ml: 120 },
          ended_at: bottle.occurredAt + 600_000,
        },
      }),
    );
  });

  it('rolls the row back when the outbox write fails', () => {
    const { id } = repo.insert({ ...bottle, payload: { ml: 90, milk: 'formula' } });
    failOn('outbox', 'INSERT');
    expect(() => repo.patch(id, { payload: { ml: 120 } })).toThrow('forced failure');
    expect(repo.get(id)?.payload).toEqual({ ml: 90, milk: 'formula' });
    expect(count('outbox')).toBe(1);
  });

  it('rejects a change that makes the payload invalid, or adds an unknown field', () => {
    const { id } = repo.insert({ ...bottle, payload: { ml: 90, milk: 'formula' } });
    expect(() => repo.patch(id, { payload: { ml: 0 } })).toThrow(
      expect.objectContaining({ reason: 'invalid_payload' }) as EventWriteError,
    );
    expect(() => repo.patch(id, { payload: { colour: 'x' } })).toThrow(
      expect.objectContaining({ reason: 'unknown_fields' }) as EventWriteError,
    );
    expect(count('outbox')).toBe(1);
  });

  it('keeps payload fields written by a newer app version (P1-F1)', () => {
    // As a pull would store it: a field this version's schema doesn't know.
    const { id } = repo.insert({ ...bottle, payload: { ml: 90, milk: 'formula' } });
    mem.db
      .update(events)
      .set({ payload: { ml: 90, milk: 'formula', bottle_brand: 'x' } })
      .where(eq(events.id, id))
      .run();

    repo.patch(id, { payload: { ml: 100 } });

    const row = mem.db.select().from(events).where(eq(events.id, id)).get();
    expect(row?.payload).toEqual({ ml: 100, milk: 'formula', bottle_brand: 'x' });
    expect(outboxRows()[1]?.body.payload).toEqual({ ml: 100 });
    expect(repo.get(id)?.payload).toEqual({ ml: 100, milk: 'formula' });
  });

  it('refuses to patch a deleted event (delete is final, SDD 5.2)', () => {
    const { id } = repo.insert({ ...bottle, payload: { ml: 90, milk: 'formula' } });
    repo.softDelete(id);
    expect(() => repo.patch(id, { payload: { ml: 100 } })).toThrow(
      expect.objectContaining({ reason: 'deleted' }) as EventWriteError,
    );
  });
});

describe('softDelete', () => {
  it('marks the row deleted, hides it from list and queues a delete op', () => {
    const { id } = repo.insert({ ...bottle, payload: { ml: 90, milk: 'formula' } });
    deps.advance(1_000);
    repo.softDelete(id);

    expect(count('events')).toBe(1);
    expect(mem.db.select().from(events).get()?.deletedAt).toBe(deps.now());
    expect(repo.list()).toEqual([]);
    expect(outboxRows()[1]).toEqual(
      expect.objectContaining({
        op: 'delete',
        body: expect.objectContaining({ id, deleted_at: deps.now() }),
      }),
    );
  });

  it('rolls back when the outbox write fails', () => {
    const { id } = repo.insert({ ...bottle, payload: { ml: 90, milk: 'formula' } });
    failOn('outbox', 'INSERT');
    expect(() => repo.softDelete(id)).toThrow('forced failure');
    expect(repo.list().map((e) => e.id)).toEqual([id]);
  });

  it('does nothing the second time', () => {
    const { id } = repo.insert({ ...bottle, payload: { ml: 90, milk: 'formula' } });
    repo.softDelete(id);
    repo.softDelete(id);
    expect(count('outbox')).toBe(2);
  });
});

describe('reads and change notifications', () => {
  it('lists live events newest first', () => {
    const early = repo.insert({ ...bottle, payload: { ml: 60, milk: 'formula' } });
    const late = repo.insert({
      ...bottle,
      occurredAt: bottle.occurredAt + 3_600_000,
      payload: { ml: 90, milk: 'breast' },
    });
    expect(repo.list().map((e) => e.id)).toEqual([late.id, early.id]);
  });

  it('notifies subscribers after a committed write, not after a failed one', () => {
    const listener = jest.fn();
    const unsubscribe = repo.subscribe(listener);
    const { id } = repo.insert({ ...bottle, payload: { ml: 90, milk: 'formula' } });
    repo.patch(id, { payload: { ml: 95 } });
    repo.softDelete(id);
    expect(listener).toHaveBeenCalledTimes(3);

    failOn('outbox', 'INSERT');
    expect(() => repo.insert({ ...bottle, payload: { ml: 90, milk: 'formula' } })).toThrow();
    expect(listener).toHaveBeenCalledTimes(3);

    unsubscribe();
    listener.mockClear();
  });

  it('uses the real household and user ids once they exist in meta', () => {
    mem.db
      .insert(meta)
      .values([
        { key: META_KEYS.householdId, value: 'real-household' },
        { key: META_KEYS.userId, value: 'real-user' },
      ])
      .run();
    const fresh = createEventsRepository(mem.db, deps);
    const event = fresh.insert({ ...bottle, payload: { ml: 90, milk: 'formula' } });
    expect(event).toMatchObject({ householdId: 'real-household', createdBy: 'real-user' });
  });
});

describe('list order', () => {
  // Controlled ids so id order and insertion order disagree on purpose.
  const idA = '01999999-0000-7000-8000-00000000000a';
  const idB = '01999999-0000-7000-8000-00000000000b';

  function repoWithIds(db: MemoryDb['db'], ids: string[]) {
    const queue = [...ids];
    return createEventsRepository(db, {
      now: deps.now,
      newId: () => queue.shift() ?? 'unexpected',
    });
  }

  it('orders by when events happened, not by id: a backfilled entry sorts below a newer one', () => {
    const recent = repo.insert({ ...bottle, payload: { ml: 90, milk: 'formula' } });
    deps.advance(60_000);
    // Logged later (so a larger v7 id) but it happened two hours earlier.
    const backfilled = repo.insert({
      ...bottle,
      occurredAt: bottle.occurredAt - 7_200_000,
      payload: { ml: 60, milk: 'formula' },
    });
    expect(backfilled.id > recent.id).toBe(true);
    expect(repo.list().map((e) => e.id)).toEqual([recent.id, backfilled.id]);
  });

  it('orders events at the same instant, logged in the same millisecond, the same way on every phone', async () => {
    // Same occurred time and the same clock millisecond: nothing but the id tells them apart.
    const payloads = [
      { type: 'diaper' as const, occurredAt: bottle.occurredAt, payload: { kind: 'wet' } },
      {
        type: 'feed_bottle' as const,
        occurredAt: bottle.occurredAt,
        payload: { ml: 30, milk: 'breast' },
      },
    ];
    // Phone 1 writes A then B; phone 2 ends up with the same rows in the opposite order.
    const phone1 = repoWithIds(mem.db, [idA, idB]);
    phone1.insert(payloads[0]!);
    phone1.insert(payloads[1]!);
    const other = await createMemoryDb();
    const phone2 = repoWithIds(other.db, [idB, idA]);
    phone2.insert(payloads[1]!);
    phone2.insert(payloads[0]!);

    const order1 = phone1.list().map((e) => e.id);
    const order2 = phone2.list().map((e) => e.id);
    expect(order1).toEqual([idB, idA]);
    expect(order2).toEqual(order1);
    expect(phone1.list().map((e) => e.id)).toEqual(order1);
  });
});

describe('rows that can no longer be shown', () => {
  let warn: jest.SpyInstance;
  beforeEach(() => {
    warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => {
    warn.mockRestore();
  });

  it('skips a row whose stored payload fails validation, with a warning naming its id', () => {
    const good = repo.insert({ ...bottle, payload: { ml: 90, milk: 'formula' } });
    const bad = repo.insert({ ...bottle, payload: { ml: 91, milk: 'formula' } });
    mem.db
      .update(events)
      .set({ payload: { ml: 5000, milk: 'formula' } })
      .where(eq(events.id, bad.id))
      .run();

    expect(repo.list().map((e) => e.id)).toEqual([good.id]);
    expect(repo.get(bad.id)).toBeNull();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining(bad.id));
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('failed validation'));
    // The payload itself never reaches the log (rule 8).
    expect(warn.mock.calls.flat().join(' ')).not.toMatch(/5000|formula/);
  });

  it('skips a row whose type has no activity module, with a warning naming its id', () => {
    const e = repo.insert({ ...bottle, payload: { ml: 90, milk: 'formula' } });
    mem.db.update(events).set({ type: 'bath' }).where(eq(events.id, e.id)).run();
    expect(repo.list()).toEqual([]);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining(e.id));
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('no activity module'));
  });

  it('warns about nothing when every row is valid', () => {
    repo.insert({ ...bottle, payload: { ml: 90, milk: 'formula' } });
    repo.list();
    expect(warn).not.toHaveBeenCalled();
  });
});

describe('insertGroup', () => {
  const pair = [
    {
      type: 'feed_bottle' as const,
      occurredAt: bottle.occurredAt,
      payload: { ml: 30, milk: 'breast' },
    },
    { type: 'feed_breast' as const, occurredAt: bottle.occurredAt, payload: { side: 'left' } },
  ];

  it('writes every event with one shared group id and one outbox op each', () => {
    const [a, b] = repo.insertGroup(pair);
    expect(a?.groupId).toMatch(V7);
    expect(b?.groupId).toBe(a?.groupId);
    expect(outboxRows().map((row) => [row.op, row.entityId, row.body.group_id])).toEqual([
      ['insert', a?.id, a?.groupId],
      ['insert', b?.id, a?.groupId],
    ]);
  });

  it('writes nothing if any event in the group is invalid', () => {
    expect(() =>
      repo.insertGroup([pair[0]!, { ...pair[1]!, payload: { side: 'middle' } }]),
    ).toThrow(expect.objectContaining({ reason: 'invalid_payload' }) as EventWriteError);
    expect(count('events')).toBe(0);
  });

  it('writes nothing from the group when the second event row fails', () => {
    // Event 1 and its outbox op are written before event 2 fails: all must roll back.
    mem.sqlite.run(
      "CREATE TRIGGER fail_second_event BEFORE INSERT ON events WHEN (SELECT count(*) FROM events) >= 1 BEGIN SELECT RAISE(ABORT, 'forced failure'); END",
    );
    const listener = jest.fn();
    repo.subscribe(listener);
    expect(() => repo.insertGroup(pair)).toThrow('forced failure');
    expect(count('events')).toBe(0);
    expect(count('outbox')).toBe(0);
    expect(listener).not.toHaveBeenCalled();
  });

  it('rolls the whole group back when a later write fails', () => {
    // Fail only the second outbox insert: the first event and op must roll back too.
    mem.sqlite.run(
      "CREATE TRIGGER fail_second BEFORE INSERT ON outbox WHEN (SELECT count(*) FROM outbox) >= 1 BEGIN SELECT RAISE(ABORT, 'forced failure'); END",
    );
    expect(() => repo.insertGroup(pair)).toThrow('forced failure');
    expect(count('events')).toBe(0);
    expect(count('outbox')).toBe(0);
  });
});
