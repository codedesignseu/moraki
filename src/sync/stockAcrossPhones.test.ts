/// <reference types="node" />
// P3-02's done-when: the fridge total drops on both phones after a feed
// poured from it. Stock is derived (SDD 6.3), so what makes the two agree is
// the events reaching each other, not a number being sent.
import { randomBytes } from 'node:crypto';

import { readLinkedIdentity } from '@/db/identity';
import { META_KEYS } from '@/db/meta';
import { createEventsRepository, type EventsRepository } from '@/db/repositories/events';
import { createOutboxRepository, type OutboxRepository } from '@/db/repositories/outbox';
import { meta } from '@/db/schema';
import { newId } from '@/domain/ids';
import { selectStock } from '@/domain/stock/stockState';
import { createMemoryDb } from '@/db/testing/memoryDb';
import { createFakeServer, type FakeServer } from '@/testing/fakeServer';

import { createPullEngine } from './pullEngine';
import { createPushEngine } from './pushEngine';

const NOW = Date.UTC(2026, 9, 28, 12, 0);
const HOUSEHOLD = '0190a0b0-0000-7000-8000-0000000000a1';
const BABY = '0190a0b0-0000-7000-8000-0000000000b1';
const MUM = '0190a0b0-0000-7000-8000-00000000000a';
const DAD = '0190a0b0-0000-7000-8000-00000000000b';

async function makePhone(userId: string, server: FakeServer) {
  const { db } = await createMemoryDb();
  const clock = { now: NOW };
  const events: EventsRepository = createEventsRepository(db, {
    now: () => clock.now,
    newId: (at: number) => newId(at, () => new Uint8Array(randomBytes(16))),
  });
  const outbox: OutboxRepository = createOutboxRepository(db);
  for (const [key, value] of [
    [META_KEYS.householdId, HOUSEHOLD],
    [META_KEYS.userId, userId],
    [META_KEYS.localHouseholdId, HOUSEHOLD],
    [META_KEYS.localBabyId, BABY],
    [META_KEYS.localUserId, userId],
  ] as const) {
    db.insert(meta)
      .values({ key, value })
      .onConflictDoUpdate({ target: meta.key, set: { value } })
      .run();
  }
  const state = { status: 'signedIn' as const, user: { id: userId, email: null } };
  const auth = {} as never;
  const linked = () => readLinkedIdentity(db);
  return {
    events,
    clock,
    fridge: () => selectStock(events.list()).fridge,
    push: createPushEngine({
      linked,
      outbox,
      auth,
      state,
      now: () => clock.now,
      send: async (_auth, rows) => server.push(userId, rows, clock.now),
    }),
    pull: createPullEngine({
      linked,
      events,
      outbox,
      auth,
      state,
      fetchPage: async (_auth, _household, cursor, limit) => server.page(cursor, limit),
    }),
  };
}

describe('milk in the fridge, seen from both phones', () => {
  it('drops on both after a bottle poured from it', async () => {
    const server = createFakeServer(HOUSEHOLD, BABY);
    const mum = await makePhone(MUM, server);
    const dad = await makePhone(DAD, server);

    // Mum pumps 200 into the fridge and it reaches dad's phone.
    mum.events.insert({ type: 'pump', occurredAt: NOW, payload: { ml: 200, dest: 'fridge' } });
    await mum.push.push();
    await dad.pull.pull();

    expect(mum.fridge()).toEqual({ ml: 200, oldestAt: NOW, short: false });
    expect(dad.fridge()).toEqual({ ml: 200, oldestAt: NOW, short: false });

    // Dad gives a 120 bottle from the fridge.
    dad.clock.now = NOW + 3_600_000;
    dad.events.insert({
      type: 'feed_bottle',
      occurredAt: dad.clock.now,
      payload: { ml: 120, milk: 'breast', from_stock: 'fridge' },
    });

    // It drops on his phone at once, before anything is sent.
    expect(dad.fridge().ml).toBe(80);
    expect(mum.fridge().ml).toBe(200);

    await dad.push.push();
    await mum.pull.pull();

    // And on hers once the entry arrives. The milk that is left keeps the age
    // of the batch it came from.
    expect(mum.fridge()).toEqual({ ml: 80, oldestAt: NOW, short: false });
    expect(dad.fridge()).toEqual(mum.fridge());
  });

  it('a bottle not poured from a store leaves the fridge alone', async () => {
    const server = createFakeServer(HOUSEHOLD, BABY);
    const mum = await makePhone(MUM, server);
    const dad = await makePhone(DAD, server);

    mum.events.insert({ type: 'pump', occurredAt: NOW, payload: { ml: 200, dest: 'fridge' } });
    mum.events.insert({
      type: 'feed_bottle',
      occurredAt: NOW + 60_000,
      payload: { ml: 90, milk: 'formula' },
    });
    await mum.push.push();
    await dad.pull.pull();

    expect(dad.fridge().ml).toBe(200);
  });

  it('both phones pouring at once end up agreeing, even past empty', async () => {
    const server = createFakeServer(HOUSEHOLD, BABY);
    const mum = await makePhone(MUM, server);
    const dad = await makePhone(DAD, server);

    mum.events.insert({ type: 'pump', occurredAt: NOW, payload: { ml: 150, dest: 'fridge' } });
    await mum.push.push();
    await dad.pull.pull();

    // Neither knows about the other's bottle yet, and together they are more
    // than the fridge holds.
    const at = NOW + 1_800_000;
    mum.events.insert({
      type: 'feed_bottle',
      occurredAt: at,
      payload: { ml: 100, milk: 'breast', from_stock: 'fridge' },
    });
    dad.events.insert({
      type: 'feed_bottle',
      occurredAt: at,
      payload: { ml: 100, milk: 'breast', from_stock: 'fridge' },
    });
    expect(mum.fridge().ml).toBe(50);
    expect(dad.fridge().ml).toBe(50);

    for (const phone of [mum, dad]) await phone.push.push();
    for (const phone of [mum, dad]) await phone.pull.pull();

    // 50 short: both show nothing left and ask for the count to be checked,
    // rather than one phone showing milk the other has already used.
    expect(mum.fridge()).toEqual({ ml: 0, oldestAt: null, short: true });
    expect(dad.fridge()).toEqual(mum.fridge());
  });
});
