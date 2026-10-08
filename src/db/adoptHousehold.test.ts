import { eq } from 'drizzle-orm';

import { adoptHousehold, localOnlyCount } from './adoptHousehold';
import { readIdentity, readLinkedIdentity } from './identity';
import { createEventsRepository } from './repositories/events';
import { createOutboxRepository } from './repositories/outbox';
import { babies, events, outbox } from './schema';
import { createMemoryDb, testDeps } from './testing/memoryDb';

const NOW = Date.UTC(2026, 9, 28, 12, 0);
const TARGET = {
  userId: '0190a0b0-0000-7000-8000-00000000u001'.replace('u', 'a'),
  householdId: '0190a0b0-0000-7000-8000-0000000000a2',
  babyId: '0190a0b0-0000-7000-8000-0000000000b2',
  babyName: 'Ella',
};

async function phone() {
  const { db } = await createMemoryDb();
  const deps = testDeps(NOW);
  return { db, deps, events: createEventsRepository(db, deps), outbox: createOutboxRepository(db) };
}

describe('taking a phone’s own entries into a household', () => {
  it('keeps every entry, now belonging to the household and this account', async () => {
    const p = await phone();
    const before = readIdentity(p.db);
    const bottle = p.events.insert({
      type: 'feed_bottle',
      occurredAt: NOW - 3_600_000,
      payload: { ml: 90, milk: 'formula' },
    });
    const diaper = p.events.insert({ type: 'diaper', occurredAt: NOW, payload: { kind: 'wet' } });

    expect(localOnlyCount(p.db)).toBe(2);
    expect(adoptHousehold(p.db, TARGET, NOW)).toEqual({ events: 2, ops: 2, linked: true });
    p.events.forgetIdentity(); // the repository was still on the old ids

    // Same entries, same ids: nothing was lost or made again.
    expect(p.events.list().map((event) => event.id)).toEqual([diaper.id, bottle.id]);
    for (const row of p.db.select().from(events).all()) {
      expect(row).toMatchObject({
        householdId: TARGET.householdId,
        babyId: TARGET.babyId,
        createdBy: TARGET.userId,
        updatedBy: TARGET.userId,
      });
      expect(row.createdBy).not.toBe(before.userId);
    }
  });

  it('rewrites what is waiting to be sent, so it matches what is stored', async () => {
    const p = await phone();
    p.events.insert({ type: 'diaper', occurredAt: NOW, payload: { kind: 'dirty' } });
    adoptHousehold(p.db, TARGET, NOW);

    const [op] = p.db.select().from(outbox).all();
    expect(JSON.parse(op!.body)).toMatchObject({
      household_id: TARGET.householdId,
      baby_id: TARGET.babyId,
      created_by: TARGET.userId,
      updated_by: TARGET.userId,
    });
  });

  it('opens the gate on sending, reading and listening', async () => {
    const p = await phone();
    expect(readLinkedIdentity(p.db)).toBeNull();

    adoptHousehold(p.db, TARGET, NOW);

    expect(readLinkedIdentity(p.db)).toEqual({
      householdId: TARGET.householdId,
      userId: TARGET.userId,
    });
    // And the repository now writes new entries as the household's.
    expect(readIdentity(p.db)).toEqual({
      householdId: TARGET.householdId,
      babyId: TARGET.babyId,
      userId: TARGET.userId,
    });
  });

  it('stores the baby, which a pull would never bring (P2-F11)', async () => {
    const p = await phone();
    adoptHousehold(p.db, TARGET, NOW);
    expect(p.db.select().from(babies).where(eq(babies.id, TARGET.babyId)).all()).toEqual([
      expect.objectContaining({ id: TARGET.babyId, name: 'Ella', householdId: TARGET.householdId }),
    ]);
  });

  it('leaves entries that came from the server alone', async () => {
    const p = await phone();
    const mine = p.events.insert({ type: 'diaper', occurredAt: NOW, payload: { kind: 'wet' } });
    // An entry pulled from the household, logged by the other caregiver.
    p.events.applyFromServer([
      {
        id: '0190a0b0-0000-7000-8000-0000000000e9',
        householdId: TARGET.householdId,
        babyId: TARGET.babyId,
        type: 'feed_bottle',
        occurredAt: NOW - 600_000,
        endedAt: null,
        payload: { ml: 120, milk: 'formula' },
        groupId: null,
        createdBy: '0190a0b0-0000-7000-8000-0000000000c1',
        updatedBy: '0190a0b0-0000-7000-8000-0000000000c1',
        clientCreatedAt: NOW - 600_000,
        serverUpdatedAt: NOW,
        seq: 5,
        deletedAt: null,
      },
    ]);

    expect(adoptHousehold(p.db, TARGET, NOW)).toMatchObject({ events: 1 });
    p.events.forgetIdentity();
    const theirs = p.events.get('0190a0b0-0000-7000-8000-0000000000e9');
    expect(theirs).toMatchObject({ createdBy: '0190a0b0-0000-7000-8000-0000000000c1' });
    expect(p.events.get(mine.id)).toMatchObject({ createdBy: TARGET.userId });
  });

  it('does nothing the second time, so a retry is harmless', async () => {
    const p = await phone();
    p.events.insert({ type: 'diaper', occurredAt: NOW, payload: { kind: 'wet' } });
    const first = adoptHousehold(p.db, TARGET, NOW);
    p.events.forgetIdentity();
    const second = adoptHousehold(p.db, TARGET, NOW);
    p.events.forgetIdentity();

    expect(first).toEqual({ events: 1, ops: 1, linked: true });
    expect(second).toEqual({ events: 0, ops: 0, linked: false });
    expect(p.events.list()).toHaveLength(1);
  });

  it('counts nothing to take on a phone that has logged nothing', async () => {
    const p = await phone();
    expect(localOnlyCount(p.db)).toBe(0);
    // Nothing moved, but the phone is now on the household's ids (TestFlight build 2).
    expect(adoptHousehold(p.db, TARGET, NOW)).toEqual({ events: 0, ops: 0, linked: true });
    expect(readLinkedIdentity(p.db)).not.toBeNull(); // still linked, ready to sync
  });

  it('keeps a held delete waiting, and sends it for the household', async () => {
    const p = await phone();
    const entry = p.events.insert({ type: 'diaper', occurredAt: NOW, payload: { kind: 'wet' } });
    p.events.softDelete(entry.id);
    adoptHousehold(p.db, TARGET, NOW);

    const ops = p.db.select().from(outbox).all();
    expect(ops.map((op) => op.op)).toEqual(['insert', 'delete']);
    expect(ops.find((op) => op.op === 'delete')?.notBefore).toBeGreaterThan(NOW);
    expect(JSON.parse(ops[0]!.body)).toMatchObject({ household_id: TARGET.householdId });
  });
});
