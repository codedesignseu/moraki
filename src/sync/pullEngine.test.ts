import { META_KEYS } from '@/db/meta';
import {
  createDevicePrefsRepository,
  type DevicePrefsRepository,
} from '@/db/repositories/devicePrefs';
import { createEventsRepository } from '@/db/repositories/events';
import { createOutboxRepository } from '@/db/repositories/outbox';
import { meta, outbox } from '@/db/schema';
import { createMemoryDb, testDeps } from '@/db/testing/memoryDb';
import { readLinkedIdentity } from '@/db/identity';
import type { PulledEvent } from '@/domain/sync/pendingProtection';

import type { Auth } from './auth';
import { createPullEngine } from './pullEngine';
import { PULL_PAGE, PullTransportError } from './pullEvents';

const NOW = Date.UTC(2026, 9, 28, 12, 0);
const USER = '00000000-0000-0000-0000-0000000000a1';
const OTHER_USER = '00000000-0000-0000-0000-0000000000a9';
const HOUSEHOLD = '00000000-0000-0000-0000-0000000000a2';
const BABY = '00000000-0000-0000-0000-0000000000b1';

const signedIn = { status: 'signedIn' as const, user: { id: USER, email: 'a@example.test' } };
const auth = {} as Auth;

/** An event as it comes back from the other phone, through the server. */
const fromServer = (id: string, seq: number, changes: Partial<PulledEvent> = {}): PulledEvent => ({
  id,
  householdId: HOUSEHOLD,
  babyId: BABY,
  type: 'feed_bottle',
  occurredAt: NOW - 3_600_000,
  endedAt: null,
  payload: { ml: 90, milk: 'formula' },
  groupId: null,
  createdBy: OTHER_USER,
  updatedBy: OTHER_USER,
  clientCreatedAt: NOW - 3_600_000,
  serverUpdatedAt: NOW,
  seq,
  deletedAt: null,
  ...changes,
});

async function harness() {
  const { db } = await createMemoryDb();
  const deps = testDeps(NOW);
  const events = createEventsRepository(db, deps);
  const outboxRepo = createOutboxRepository(db);
  const link = () => {
    db.insert(meta).values({ key: META_KEYS.householdId, value: HOUSEHOLD }).run();
    db.insert(meta).values({ key: META_KEYS.userId, value: USER }).run();
    // With the phone linked, its own entries belong to that household too.
    db.insert(meta)
      .values({ key: META_KEYS.localBabyId, value: BABY })
      .onConflictDoUpdate({
        target: meta.key,
        set: { value: BABY },
      })
      .run();
  };
  const engine = (pages: PulledEvent[][] | Error, seen?: { calls: number[] }) => {
    let page = 0;
    return createPullEngine({
      linked: () => readLinkedIdentity(db),
      events,
      outbox: outboxRepo,
      auth,
      state: signedIn,
      fetchPage: async (_auth, _household, cursor) => {
        seen?.calls.push(cursor);
        if (pages instanceof Error) throw pages;
        return pages[page++] ?? [];
      },
    });
  };
  return { db, deps, events, outbox: outboxRepo, link, engine };
}

describe('pulling the household', () => {
  it('stores what the other phone logged, and remembers how far it read', async () => {
    const h = await harness();
    h.link();
    const seen = { calls: [] as number[] };

    const outcome = await h.engine([[fromServer('e1', 4), fromServer('e2', 7)]], seen).pull();

    expect(outcome).toEqual({ kind: 'pulled', stored: 2, skipped: 0, cursor: 7 });
    expect(seen.calls).toEqual([0]); // started from the beginning
    expect(h.events.list().map((event) => event.id)).toEqual(['e2', 'e1']);
    expect(h.outbox.cursor()).toBe(7);
    // Pulled events are not ours to send back.
    expect(h.db.select().from(outbox).all()).toEqual([]);
  });

  it('carries on from the cursor next time', async () => {
    const h = await harness();
    h.link();
    const seen = { calls: [] as number[] };
    const engine = h.engine([[fromServer('e1', 4)], [fromServer('e2', 9)]], seen);
    await engine.pull();
    await engine.pull();
    expect(seen.calls).toEqual([0, 4]);
    expect(h.outbox.cursor()).toBe(9);
  });

  it('keeps reading while the pages are full', async () => {
    const h = await harness();
    h.link();
    const full = Array.from({ length: PULL_PAGE }, (_, i) => fromServer(`full-${i}`, i + 1));
    const seen = { calls: [] as number[] };

    const outcome = await h.engine([full, [fromServer('last', PULL_PAGE + 1)]], seen).pull();
    expect(seen.calls).toEqual([0, PULL_PAGE]);
    expect(outcome).toMatchObject({ stored: PULL_PAGE + 1, cursor: PULL_PAGE + 1 });
  });

  it('leaves the cursor where it was when the server can not be reached', async () => {
    const h = await harness();
    h.link();
    const outcome = await h.engine(new PullTransportError('Network request failed')).pull();
    expect(outcome).toMatchObject({ kind: 'failed', failures: 1, retryInMs: 2_000 });
    expect(h.outbox.cursor()).toBe(0);
    expect(h.events.list()).toEqual([]);
  });

  it('reads nothing until the phone is linked to the household it signed in to', async () => {
    const h = await harness();
    const seen = { calls: [] as number[] };
    expect(await h.engine([[fromServer('e1', 4)]], seen).pull()).toEqual({
      kind: 'blocked',
      by: 'not_linked',
    });
    expect(seen.calls).toEqual([]);
    expect(h.events.list()).toEqual([]);
  });

  it('takes a change to an event it already has', async () => {
    const h = await harness();
    h.link();
    await h.engine([[fromServer('e1', 4)]]).pull();
    await h
      .engine([[fromServer('e1', 12, { payload: { ml: 150, milk: 'formula' }, updatedBy: USER })]])
      .pull();

    expect(h.events.get('e1')).toMatchObject({ payload: { ml: 150, milk: 'formula' } });
    expect(h.outbox.cursor()).toBe(12);
  });

  it('takes a delete from the other phone', async () => {
    const h = await harness();
    h.link();
    await h.engine([[fromServer('e1', 4)]]).pull();
    await h.engine([[fromServer('e1', 15, { deletedAt: NOW })]]).pull();
    expect(h.events.list()).toEqual([]); // gone from the timeline
    expect(h.events.get('e1')).toMatchObject({ deletedAt: NOW }); // kept, marked deleted
  });

  it('skips an event whose payload this version can not read, and reads on', async () => {
    const h = await harness();
    h.link();
    jest.spyOn(console, 'warn').mockImplementation(() => {});

    const outcome = await h
      .engine([
        [
          fromServer('bad', 5, { type: 'feed_bottle', payload: { ml: 'lots' } }),
          fromServer('good', 6),
        ],
      ])
      .pull();

    expect(outcome).toMatchObject({ stored: 1, skipped: 1, cursor: 6 });
    expect(h.events.list().map((event) => event.id)).toEqual(['good']);
  });
});

describe('an unsent local edit meeting an older server copy', () => {
  it('keeps the local amount and takes the rest of the server row', async () => {
    const h = await harness();
    h.link();
    await h.engine([[fromServer('e1', 4)]]).pull();

    // Edited here, not sent yet.
    h.events.patch('e1', { payload: { ml: 150 } });
    expect(h.db.select().from(outbox).all()).toHaveLength(1);

    // The server still has 90, and knows something this phone doesn't.
    await h
      .engine([[fromServer('e1', 11, { payload: { ml: 90, milk: 'breast' }, endedAt: NOW })]])
      .pull();

    expect(h.events.get('e1')).toMatchObject({
      payload: { ml: 150, milk: 'breast' }, // mine kept, theirs taken
      endedAt: NOW,
    });
    expect(h.db.select().from(outbox).all()).toHaveLength(1); // still waiting to be sent
  });

  it('keeps an entry this phone has deleted but not yet sent', async () => {
    const h = await harness();
    h.link();
    await h.engine([[fromServer('e1', 4)]]).pull();
    h.events.softDelete('e1');

    await h.engine([[fromServer('e1', 13, { payload: { ml: 200, milk: 'formula' } })]]).pull();

    // Still deleted here, though the server's copy isn't; the rest is theirs.
    expect(h.events.list()).toEqual([]);
    expect(h.events.get('e1')).toMatchObject({
      deletedAt: expect.any(Number),
      payload: { ml: 200, milk: 'formula' },
    });
    expect(h.outbox.cursor()).toBe(13);
  });

  it('keeps an entry made here whose insert is still waiting', async () => {
    const h = await harness();
    h.link();
    const mine = h.events.insert({
      type: 'feed_bottle',
      occurredAt: NOW,
      payload: { ml: 70, milk: 'breast' },
    });

    // The server answers with an older shape of the same id (it can only
    // happen through a bug, and the local copy is the one to trust).
    await h.engine([[fromServer(mine.id, 21, { payload: { ml: 10, milk: 'formula' } })]]).pull();

    expect(h.events.get(mine.id)).toMatchObject({ payload: { ml: 70, milk: 'breast' } });
    expect(h.outbox.cursor()).toBe(21);
  });
});

describe('the household’s own row', () => {
  // The record's ids are validated as UUIDs, so these are well-formed ones.
  const ACCOUNT = '0190a0b0-0000-7000-8000-00000000000a';
  const HOUSE = '0190a0b0-0000-7000-8000-0000000000a1';
  const CHILD = '0190a0b0-0000-7000-8000-0000000000b1';

  const household = {
    name: 'Ella',
    reminderIntervalMin: 210,
    secondReminderMin: 30,
    baby: { id: CHILD, name: 'Eleni', bornAt: NOW - 86_400_000, birthWeightG: 3450 },
  };

  /** A pull that brings the household row as well as its events. */
  async function withPrefs(record?: Parameters<DevicePrefsRepository['set']>[1]) {
    const { db } = await createMemoryDb();
    const prefs = createDevicePrefsRepository(db);
    const events = createEventsRepository(db, testDeps(NOW));
    const outboxRepo = createOutboxRepository(db);
    db.insert(meta).values({ key: META_KEYS.householdId, value: HOUSE }).run();
    db.insert(meta).values({ key: META_KEYS.userId, value: ACCOUNT }).run();
    if (record !== undefined) prefs.set('accountHousehold', record as never);
    const engine = createPullEngine({
      linked: () => readLinkedIdentity(db),
      events,
      outbox: outboxRepo,
      devicePrefs: prefs,
      auth,
      state: { status: 'signedIn', user: { id: ACCOUNT, email: 'a@example.test' } },
      fetchPage: async () => [],
      fetchHousehold: async () => household,
    });
    return { prefs, engine };
  }

  it('takes the household’s reminder settings, whatever this phone had', async () => {
    const h = await withPrefs();
    h.prefs.set('reminderIntervalMin', 480);

    await h.engine.pull();

    expect(h.prefs.get('reminderIntervalMin')).toBe(210);
    expect(h.prefs.get('secondReminderMin')).toBe(30);
  });

  it('updates this account’s baby details', async () => {
    const h = await withPrefs({
      userId: ACCOUNT,
      householdId: HOUSE,
      babyId: CHILD,
      babyName: 'Ella',
      role: 'caregiver',
    });

    await h.engine.pull();

    expect(h.prefs.get('accountHousehold')).toMatchObject({
      babyName: 'Eleni',
      birthWeightG: 3450,
      // Untouched: the pull says nothing about what this account may do.
      role: 'caregiver',
    });
  });

  it('leaves a record that belongs to another household alone', async () => {
    const theirs = {
      userId: ACCOUNT,
      // A household this phone is not linked to.
      householdId: '0190a0b0-0000-7000-8000-0000000000ff',
      babyId: CHILD,
      babyName: 'Someone else',
      role: 'owner' as const,
    };
    const h = await withPrefs(theirs);

    await h.engine.pull();

    // The settings still arrive; the record is not rewritten to this baby.
    expect(h.prefs.get('reminderIntervalMin')).toBe(210);
    expect(h.prefs.get('accountHousehold')).toEqual(theirs);
  });

  it('invents no record for a phone that has none', async () => {
    const h = await withPrefs();

    await h.engine.pull();

    expect(h.prefs.get('accountHousehold')).toBe(null);
  });
});
