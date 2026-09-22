// Opt-in: `npm run test:local` against `supabase start`. Two phones, one
// household, the real server: one logs, the other reads it back, and an edit
// that hasn't been sent survives the server's older copy (P2-09's done-when).
import { readLinkedIdentity } from '@/db/identity';
import { META_KEYS } from '@/db/meta';
import { createEventsRepository } from '@/db/repositories/events';
import { createOutboxRepository } from '@/db/repositories/outbox';
import { meta } from '@/db/schema';
import { createMemoryDb, testDeps } from '@/db/testing/memoryDb';
import { LOCAL_ENABLED as enabled, newUuid, phone } from '@/testing/localSupabase';

import { createHousehold } from './household';
import { acceptInvite, createInvite } from './invites';
import { createPullEngine } from './pullEngine';
import { pushOps } from './pushEvents';
import type { OutboxRow } from '@/db/repositories/outbox';

const NOW = Date.UTC(2026, 9, 28, 12, 0);

/** The receiving phone: a real local database, linked to the household. */
async function receivingPhone(householdId: string, userId: string, babyId: string) {
  const { db } = await createMemoryDb();
  const deps = testDeps(NOW);
  for (const [key, value] of [
    [META_KEYS.householdId, householdId],
    [META_KEYS.userId, userId],
  ] as const) {
    db.insert(meta).values({ key, value }).run();
  }
  db.insert(meta)
    .values({ key: META_KEYS.localBabyId, value: babyId })
    .onConflictDoUpdate({ target: meta.key, set: { value: babyId } })
    .run();
  return {
    db,
    events: createEventsRepository(db, deps),
    outbox: createOutboxRepository(db),
    linked: () => readLinkedIdentity(db),
  };
}

const row = (body: object, op: 'insert' | 'patch'): OutboxRow => ({
  id: 1,
  entity: 'event',
  entityId: (body as { id: string }).id,
  op,
  body: JSON.stringify(body),
  attempts: 0,
  lastError: null,
  createdAt: NOW,
  notBefore: null,
});

(enabled ? describe : describe.skip)('two phones, one household', () => {
  jest.setTimeout(60_000);

  it('reads back what the other phone logged, and keeps an edit that is still waiting', async () => {
    // Phone A sets up the household and invites B.
    const a = await phone('p2-09-owner');
    const household = await createHousehold(
      a.auth,
      a.user.id,
      {
        babyName: 'Ella',
        bornAt: Date.parse('2026-10-20T08:00:00Z'),
        birthWeightG: null,
        displayName: 'Maria',
        relation: 'mother',
      },
      newUuid,
    );
    const invite = await createInvite(a.auth, household.householdId, 'caregiver');
    const b = await phone('p2-09-carer');
    await acceptInvite(b.auth, invite.code, 'Nik', 'father');

    // A logs a bottle, through the same RPC the app uses.
    const eventId = newUuid();
    const bottle = {
      id: eventId,
      household_id: household.householdId,
      baby_id: household.babyId,
      type: 'feed_bottle',
      occurred_at: NOW - 1_800_000,
      ended_at: null,
      payload: { ml: 120, milk: 'formula' },
      group_id: null,
      created_by: a.user.id,
      updated_by: a.user.id,
      client_created_at: NOW - 1_800_000,
    };
    expect(await pushOps(a.auth, [row(bottle, 'insert')])).toEqual([
      { id: eventId, op: 'insert', status: 'applied', reason: null },
    ]);

    // B pulls: the bottle lands in its database, and the cursor moves.
    const receiving = await receivingPhone(household.householdId, b.user.id, household.babyId);
    const engine = createPullEngine({
      linked: receiving.linked,
      events: receiving.events,
      outbox: receiving.outbox,
      auth: b.auth,
      state: { status: 'signedIn', user: b.user },
    });
    const first = await engine.pull();
    expect(first).toMatchObject({ kind: 'pulled', stored: 1, skipped: 0 });
    expect(receiving.events.get(eventId)).toMatchObject({ payload: { ml: 120, milk: 'formula' } });
    const cursor = receiving.outbox.cursor();
    expect(cursor).toBeGreaterThan(0);

    // B corrects the amount. Nothing is pushed: the op is still in its outbox.
    receiving.events.patch(eventId, { payload: { ml: 200 } });
    expect(receiving.outbox.pending()).toBe(1);

    // Meanwhile A corrects the milk on the server, so the next pull carries
    // an older amount alongside a newer milk.
    expect(
      await pushOps(a.auth, [row({ id: eventId, payload: { milk: 'breast' } }, 'patch')]),
    ).toMatchObject([{ status: 'applied' }]);

    const second = await engine.pull();
    expect(second).toMatchObject({ kind: 'pulled', stored: 1 });
    expect(receiving.outbox.cursor()).toBeGreaterThan(cursor);

    // B's unsent amount survives; A's milk is taken.
    expect(receiving.events.get(eventId)).toMatchObject({
      payload: { ml: 200, milk: 'breast' },
    });
    expect(receiving.outbox.pending()).toBe(1);

    for (const p of [a, b]) {
      await p.auth.signOut();
      p.auth.setForeground(false);
    }
  });
});
