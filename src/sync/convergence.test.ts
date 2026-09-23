/// <reference types="node" />
// SDD 11's sync property: random entries on two phones, pushed and pulled in
// a random order, end with both phones showing the same thing.
import { randomBytes } from 'node:crypto';

import { array, assert, asyncProperty, constant, integer, nat, oneof, record } from 'fast-check';

import { readLinkedIdentity } from '@/db/identity';
import { META_KEYS } from '@/db/meta';
import { createEventsRepository, type EventsRepository } from '@/db/repositories/events';
import { createOutboxRepository, type OutboxRepository } from '@/db/repositories/outbox';
import { events as eventsTable, meta, outbox as outboxTable } from '@/db/schema';
import { newId } from '@/domain/ids';
import { DEFAULT_HOME_SETTINGS, selectHomeState } from '@/domain/home/homeState';
import { createMemoryDb, type MemoryDb } from '@/db/testing/memoryDb';
import { createFakeServer, type FakeServer } from '@/testing/fakeServer';

import { createPullEngine } from './pullEngine';
import { createPushEngine } from './pushEngine';

const NOW = Date.UTC(2026, 9, 28, 12, 0);
const TZ = 'Europe/Nicosia';
const HOUSEHOLD = '0190a0b0-0000-7000-8000-0000000000a1';
const BABY = '0190a0b0-0000-7000-8000-0000000000b1';
const USERS = ['0190a0b0-0000-7000-8000-00000000000a', '0190a0b0-0000-7000-8000-00000000000b'];

type Phone = {
  db: MemoryDb['db'];
  events: EventsRepository;
  outbox: OutboxRepository;
  push: ReturnType<typeof createPushEngine>;
  pull: ReturnType<typeof createPullEngine>;
  clock: { now: number };
};

/** One phone, already part of the household, talking to the fake server. */
async function makePhone(userId: string, server: FakeServer): Promise<Phone> {
  const { db } = await createMemoryDb();
  const clock = { now: NOW };
  const deps = {
    now: () => clock.now,
    newId: (at: number) => newId(at, () => new Uint8Array(randomBytes(16))),
  };
  const events = createEventsRepository(db, deps);
  const outbox = createOutboxRepository(db);
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
  return {
    db,
    events,
    outbox,
    clock,
    push: createPushEngine({
      linked: () => readLinkedIdentity(db),
      outbox,
      auth,
      state,
      now: () => clock.now,
      send: async (_auth, rows) => server.push(userId, rows, clock.now),
    }),
    pull: createPullEngine({
      linked: () => readLinkedIdentity(db),
      events,
      outbox,
      auth,
      state,
      fetchPage: async (_auth, _household, cursor, limit) => server.page(cursor, limit),
    }),
  };
}

/** Wipes a phone between runs; making a database each time would be far slower. */
function reset(phone: Phone) {
  phone.db.delete(eventsTable).run();
  phone.db.delete(outboxTable).run();
  phone.db
    .insert(meta)
    .values({ key: META_KEYS.pullCursor, value: '0' })
    .onConflictDoUpdate({ target: meta.key, set: { value: '0' } })
    .run();
  phone.clock.now = NOW;
}

type Step =
  | { do: 'log'; phone: number; ml: number }
  | { do: 'edit'; phone: number; ml: number }
  | { do: 'clear'; phone: number }
  | { do: 'delete'; phone: number }
  | { do: 'push'; phone: number }
  | { do: 'pull'; phone: number }
  | { do: 'wait'; ms: number };

const step = oneof(
  record({
    do: constant('log' as const),
    phone: nat(1),
    ml: integer({ min: 10, max: 300 }),
  }),
  record({
    do: constant('edit' as const),
    phone: nat(1),
    ml: integer({ min: 10, max: 300 }),
  }),
  record({ do: constant('clear' as const), phone: nat(1) }),
  record({ do: constant('delete' as const), phone: nat(1) }),
  record({ do: constant('push' as const), phone: nat(1) }),
  record({ do: constant('pull' as const), phone: nat(1) }),
  record({ do: constant('wait' as const), ms: integer({ min: 1_000, max: 20_000 }) }),
);

describe('two phones, however the writes interleave', () => {
  let phones: Phone[];
  let server: FakeServer;

  beforeAll(async () => {
    server = createFakeServer(HOUSEHOLD, BABY);
    phones = [await makePhone(USERS[0]!, server), await makePhone(USERS[1]!, server)];
  });

  it('end up showing the same thing, over 1,000 runs (SDD 11)', async () => {
    await assert(
      asyncProperty(array(step, { minLength: 1, maxLength: 12 }), async (program: Step[]) => {
        const fresh = createFakeServer(HOUSEHOLD, BABY);
        for (const [index, phone] of phones.entries()) {
          reset(phone);
          const state = { status: 'signedIn' as const, user: { id: USERS[index]!, email: null } };
          phone.push = createPushEngine({
            linked: () => readLinkedIdentity(phone.db),
            outbox: phone.outbox,
            auth: {} as never,
            state,
            now: () => phone.clock.now,
            send: async (_auth, rows) => fresh.push(USERS[index]!, rows, phone.clock.now),
          });
          phone.pull = createPullEngine({
            linked: () => readLinkedIdentity(phone.db),
            events: phone.events,
            outbox: phone.outbox,
            auth: {} as never,
            state,
            fetchPage: async (_auth, _household, cursor, limit) => fresh.page(cursor, limit),
          });
        }

        /** What each entry should end up as, in the order the program ran. */
        const intent = new Map<string, { ml: number; cleared: boolean; deleted: boolean }>();
        const ownedBy: string[][] = [[], []];

        for (const action of program) {
          if (action.do === 'wait') {
            for (const phone of phones) phone.clock.now += action.ms;
            continue;
          }
          const phone = phones[action.phone]!;
          // A caregiver edits their own entries; two phones changing one entry
          // at the same moment is last-write-wins and has no single answer.
          const target = ownedBy[action.phone]!.findLast((id) => intent.get(id)?.deleted === false);
          switch (action.do) {
            case 'log': {
              const logged = phone.events.insert({
                type: 'feed_bottle',
                occurredAt: phone.clock.now,
                payload: { ml: action.ml, milk: 'formula', from_stock: 'fridge' },
              });
              ownedBy[action.phone]!.push(logged.id);
              intent.set(logged.id, { ml: action.ml, cleared: false, deleted: false });
              break;
            }
            case 'edit':
              if (target) {
                phone.events.patch(target, { payload: { ml: action.ml } });
                intent.set(target, { ...intent.get(target)!, ml: action.ml });
              }
              break;
            case 'clear':
              if (target) {
                phone.events.patch(target, { unset: ['from_stock'] });
                intent.set(target, { ...intent.get(target)!, cleared: true });
              }
              break;
            case 'delete':
              if (target) {
                phone.events.softDelete(target);
                intent.set(target, { ...intent.get(target)!, deleted: true });
              }
              break;
            case 'push':
              await phone.push.push();
              break;
            case 'pull':
              await phone.pull.pull();
              // P2-09's promise: a pull may not undo a change this phone has
              // made but not yet sent.
              for (const id of ownedBy[action.phone]!) {
                const waiting = phone.outbox
                  .due(Number.MAX_SAFE_INTEGER)
                  .some((op) => op.entityId === id);
                if (!waiting) continue;
                const want = intent.get(id)!;
                const row = phone.events.get(id);
                expect(row === null || row.deletedAt !== null).toBe(want.deleted);
                if (!want.deleted) {
                  expect((row!.payload as { ml: number }).ml).toBe(want.ml);
                  expect('from_stock' in (row!.payload as object)).toBe(!want.cleared);
                }
              }
              break;
          }
        }

        // Everything settles: the undo window passes, then each phone sends
        // and reads until there is nothing left to say.
        for (const phone of phones) phone.clock.now += 60_000;
        for (let round = 0; round < 3; round += 1) {
          for (const phone of phones) {
            await phone.push.push();
            await phone.pull.pull();
          }
        }

        const [a, b] = phones as [Phone, Phone];

        // Every entry ends as the phone that made it meant it to be: nothing
        // lost, nothing brought back, no edit undone.
        for (const phone of phones) {
          for (const [id, want] of intent) {
            const row = phone.events.get(id);
            expect(row).not.toBeNull();
            expect(row!.deletedAt !== null).toBe(want.deleted);
            if (want.deleted) continue;
            expect((row!.payload as { ml: number }).ml).toBe(want.ml);
            expect('from_stock' in (row!.payload as object)).toBe(!want.cleared);
          }
        }

        const shown = (phone: Phone) =>
          phone.events.list().map((event) => ({
            id: event.id,
            payload: event.payload,
            occurredAt: event.occurredAt,
          }));
        expect(shown(a)).toEqual(shown(b));

        // And the same derived state, which is what a caregiver actually sees.
        const home = (phone: Phone) =>
          selectHomeState(phone.events.list(), phone.clock.now, TZ, DEFAULT_HOME_SETTINGS);
        expect(home(a)).toEqual(home(b));
      }),
      { numRuns: 1_000 },
    );
  }, 300_000);
});
