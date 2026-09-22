import { META_KEYS } from '@/db/meta';
import { createEventsRepository } from '@/db/repositories/events';
import { createOutboxRepository, type OutboxRow } from '@/db/repositories/outbox';
import { meta } from '@/db/schema';
import { createMemoryDb, testDeps } from '@/db/testing/memoryDb';
import { readLinkedIdentity } from '@/db/identity';

import type { Auth } from './auth';
import { backoffMs } from './backoff';
import { createPushEngine } from './pushEngine';
import { PushTransportError, type PushResult } from './pushEvents';

const NOW = Date.UTC(2026, 9, 28, 12, 0);
const USER = '00000000-0000-0000-0000-0000000000u1'.replace('u1', 'a1');
const HOUSEHOLD = '00000000-0000-0000-0000-0000000000a2';

const signedIn = { status: 'signedIn' as const, user: { id: USER, email: 'a@example.test' } };
const auth = {} as Auth;

/** A server that answers however the test says, and remembers what it was sent. */
function server(answer: (rows: readonly OutboxRow[]) => PushResult[] | Error) {
  const batches: OutboxRow[][] = [];
  return {
    batches,
    send: async (_auth: Auth, rows: readonly OutboxRow[]) => {
      batches.push([...rows]);
      const result = answer(rows);
      if (result instanceof Error) throw result;
      return result;
    },
  };
}
const allApplied = (rows: readonly OutboxRow[]): PushResult[] =>
  rows.map((row) => ({ id: row.entityId, op: row.op, status: 'applied', reason: null }));

async function harness() {
  const { db } = await createMemoryDb();
  const deps = testDeps(NOW);
  const events = createEventsRepository(db, deps);
  const outbox = createOutboxRepository(db);
  /** What P2-11 will do: point this phone at the real household and user. */
  const link = () => {
    db.insert(meta).values({ key: META_KEYS.householdId, value: HOUSEHOLD }).run();
    db.insert(meta).values({ key: META_KEYS.userId, value: USER }).run();
  };
  const engine = (overrides: Partial<Parameters<typeof createPushEngine>[0]> = {}) =>
    createPushEngine({
      linked: () => readLinkedIdentity(db),
      outbox,
      auth,
      state: signedIn,
      now: deps.now,
      ...overrides,
    });
  return { db, deps, events, outbox, link, engine };
}

const bottle = (events: ReturnType<typeof createEventsRepository>, ml = 90) =>
  events.insert({ type: 'feed_bottle', occurredAt: NOW, payload: { ml, milk: 'formula' } });

describe('pushing the outbox', () => {
  it("won't send entries made before signing in, whatever the account (P2-F4)", async () => {
    const h = await harness();
    bottle(h.events);
    const fake = server(allApplied);

    expect(await h.engine({ send: fake.send }).push()).toEqual({
      kind: 'blocked',
      by: 'not_linked',
    });
    // Nothing was tried: those ops carry placeholder ids the server would
    // refuse, and they would fill the sync errors list for every P1 user.
    expect(fake.batches).toEqual([]);
    expect(h.outbox.pending()).toBe(1);
    expect(h.outbox.errors()).toEqual([]);
  });

  it('sends nothing while signed out', async () => {
    const h = await harness();
    bottle(h.events);
    h.link();
    const fake = server(allApplied);
    expect(
      await h.engine({ send: fake.send, auth: null, state: { status: 'signedOut' } }).push(),
    ).toEqual({ kind: 'blocked', by: 'signed_out' });
    expect(fake.batches).toEqual([]);
  });

  it('sends nothing when the phone is linked to another account', async () => {
    const h = await harness();
    bottle(h.events);
    h.link();
    const other = { status: 'signedIn' as const, user: { id: HOUSEHOLD, email: null } };
    const fake = server(allApplied);
    expect(await h.engine({ send: fake.send, state: other }).push()).toEqual({
      kind: 'blocked',
      by: 'other_account',
    });
    expect(fake.batches).toEqual([]);
  });

  it('drains the outbox once the phone is linked', async () => {
    const h = await harness();
    bottle(h.events);
    bottle(h.events, 120);
    h.link();
    const fake = server(allApplied);

    expect(await h.engine({ send: fake.send }).push()).toEqual({
      kind: 'pushed',
      applied: 2,
      ignored: 0,
      deferred: 0,
      rejected: 0,
    });
    expect(h.outbox.pending()).toBe(0);
    expect(fake.batches).toHaveLength(1);
    expect(fake.batches[0]!.map((row) => row.op)).toEqual(['insert', 'insert']);
  });

  it('sends at most 100 ops a call, oldest first, until nothing is left', async () => {
    const h = await harness();
    for (let i = 0; i < 150; i += 1) bottle(h.events, 30 + (i % 10));
    h.link();
    const fake = server(allApplied);

    await h.engine({ send: fake.send }).push();
    expect(fake.batches.map((batch) => batch.length)).toEqual([100, 50]);
    expect(fake.batches[0]![0]!.id).toBeLessThan(fake.batches[1]![0]!.id);
    expect(h.outbox.pending()).toBe(0);
  });

  it('clears ops the server already had, so a retry after a lost answer is harmless', async () => {
    const h = await harness();
    bottle(h.events);
    h.link();
    // The first answer never arrived; the second says it was already there.
    const lost = server(() => new PushTransportError('Network request failed'));
    const engine = h.engine({ send: lost.send });
    expect(await engine.push()).toMatchObject({ kind: 'failed', failures: 1 });
    expect(h.outbox.pending()).toBe(1);

    const retry = server((rows) =>
      rows.map((row) => ({ id: row.entityId, op: row.op, status: 'ignored', reason: 'duplicate' })),
    );
    expect(await h.engine({ send: retry.send }).push()).toMatchObject({ ignored: 1 });
    expect(h.outbox.pending()).toBe(0);
    expect(h.outbox.errors()).toEqual([]);
    // The very same op went again, and the answer cleared it.
    expect(retry.batches[0]!.map((row) => [row.entityId, row.op, row.body])).toEqual(
      lost.batches[0]!.map((row) => [row.entityId, row.op, row.body]),
    );
  });

  it('moves refused ops out of the queue and into the sync errors list', async () => {
    const h = await harness();
    const kept = bottle(h.events);
    const refused = bottle(h.events, 120);
    h.link();
    const fake = server((rows) =>
      rows.map((row) => ({
        id: row.entityId,
        op: row.op,
        status: row.entityId === refused.id ? 'rejected' : 'applied',
        reason: row.entityId === refused.id ? 'forbidden' : null,
      })),
    );

    expect(await h.engine({ send: fake.send }).push()).toMatchObject({ applied: 1, rejected: 1 });
    expect(h.outbox.pending()).toBe(0);
    expect(h.outbox.errors()).toEqual([
      expect.objectContaining({
        entityId: refused.id,
        op: 'insert',
        reason: 'forbidden',
        failedAt: NOW,
        attempts: 1,
      }),
    ]);
    expect(kept.id).not.toBe(refused.id);
  });

  it('keeps an op the server held back, and sends it once its time comes', async () => {
    const h = await harness();
    const event = bottle(h.events);
    h.events.softDelete(event.id); // held for the undo window (P1-12)
    h.link();

    // The delete isn't due yet, so only the insert goes.
    const first = server(allApplied);
    expect(await h.engine({ send: first.send }).push()).toMatchObject({ applied: 1 });
    expect(first.batches[0]!.map((row) => row.op)).toEqual(['insert']);
    expect(h.outbox.pending()).toBe(1);
    expect(h.outbox.nextDueAt(NOW)).toBeGreaterThan(NOW);

    // Nothing is due yet, so the engine sends nothing at all.
    const early = server(allApplied);
    expect(await h.engine({ send: early.send }).push()).toEqual({ kind: 'idle' });
    expect(early.batches).toEqual([]);

    // And if the server ever holds one back, the op stays in the queue.
    const held = server((rows) =>
      rows.map((row) => ({
        id: row.entityId,
        op: row.op,
        status: 'deferred' as const,
        reason: 'not_before',
      })),
    );
    const soon = NOW + 10_000;
    expect(await h.engine({ send: held.send, now: () => soon }).push()).toMatchObject({
      deferred: 1,
    });
    expect(h.outbox.pending()).toBe(1);
    expect(h.outbox.errors()).toEqual([]);

    // Once the undo window has passed it goes, and the queue empties.
    const later = NOW + 10_000;
    const due = server(allApplied);
    expect(await h.engine({ send: due.send, now: () => later }).push()).toMatchObject({
      applied: 1,
    });
    expect(due.batches[0]!.map((row) => row.op)).toEqual(['delete']);
    expect(h.outbox.pending()).toBe(0);
  });

  it('waits longer after each failed try, and starts over when the app comes back', async () => {
    const h = await harness();
    bottle(h.events);
    h.link();
    const fake = server(() => new PushTransportError('Network request failed'));
    const engine = h.engine({ send: fake.send });

    const waits: number[] = [];
    for (let i = 0; i < 6; i += 1) {
      const outcome = await engine.push();
      if (outcome.kind !== 'failed') throw new Error('expected a failure');
      waits.push(outcome.retryInMs);
    }
    expect(waits).toEqual([2_000, 5_000, 15_000, 60_000, 300_000, 300_000]);
    expect(h.outbox.pending()).toBe(1);
    expect(h.outbox.errors()).toEqual([]); // a lost connection is not a rejection

    engine.resetBackoff();
    const next = await engine.push();
    expect(next).toMatchObject({ kind: 'failed', retryInMs: backoffMs(1) });
  });

  it('starts the waits over after a push that gets through', async () => {
    const h = await harness();
    bottle(h.events);
    h.link();
    let reachable = false;
    const engine = h.engine({
      send: async (_auth, rows) => {
        if (!reachable) throw new PushTransportError('Network request failed');
        return allApplied(rows);
      },
    });

    expect(await engine.push()).toMatchObject({ retryInMs: backoffMs(1) });
    expect(await engine.push()).toMatchObject({ retryInMs: backoffMs(2) });

    reachable = true;
    expect(await engine.push()).toMatchObject({ kind: 'pushed' });

    // The next time it can't get through, the wait is back to the first step.
    reachable = false;
    bottle(h.events, 150);
    expect(await engine.push()).toMatchObject({ failures: 1, retryInMs: backoffMs(1) });
  });

  it('reports what the sync status screen needs', async () => {
    const h = await harness();
    bottle(h.events);
    const blocked = h.engine({ send: async (_auth, rows) => allApplied(rows) });
    expect(blocked.status()).toMatchObject({ pending: 1, errors: 0, blocked: 'not_linked' });

    h.link();
    const fake = server((rows) =>
      rows.map((row) => ({ id: row.entityId, op: row.op, status: 'rejected', reason: 'invalid' })),
    );
    const engine = h.engine({ send: fake.send });
    await engine.push();
    expect(engine.status()).toMatchObject({
      pending: 0,
      errors: 1,
      blocked: null,
      lastPushAt: NOW,
      failures: 0,
    });
  });
});
