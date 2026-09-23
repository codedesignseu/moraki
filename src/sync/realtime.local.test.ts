// Opt-in: `npm run test:local` against `supabase start`. The done-when for
// P2-10: one phone logs, the other has it within three seconds, told by
// realtime rather than by any timer.
import { readLinkedIdentity } from '@/db/identity';
import { META_KEYS } from '@/db/meta';
import { createEventsRepository } from '@/db/repositories/events';
import { createOutboxRepository, type OutboxRow } from '@/db/repositories/outbox';
import { meta } from '@/db/schema';
import { createMemoryDb, testDeps } from '@/db/testing/memoryDb';
import { LOCAL_ENABLED as enabled, newUuid, phone } from '@/testing/localSupabase';

import { createHousehold } from './household';
import { acceptInvite, createInvite } from './invites';
import { createPullEngine } from './pullEngine';
import { pushOps } from './pushEvents';
import { watchHousehold } from './realtime';

const NOW = Date.UTC(2026, 9, 28, 12, 0);
/** SDD: phone B updates within 3 seconds of phone A. */
const BUDGET_MS = 3_000;
/** Joining a channel is one thing; the server registering the subscription
 * behind it is another, and on a cold container it can take a few seconds. */
const WARM_UP_MS = 20_000;

(enabled ? describe : describe.skip)('two phones, one household, live', () => {
  jest.setTimeout(90_000);

  it('the other phone has the entry within three seconds, without waiting for a timer', async () => {
    const a = await phone('p2-10-owner');
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
    const b = await phone('p2-10-carer');
    await acceptInvite(b.auth, invite.code, 'Nik', 'father');

    /** A bottle from phone A, as its outbox would send it. */
    const bottleFrom = (id: string): OutboxRow => ({
      id: 1,
      entity: 'event',
      entityId: id,
      op: 'insert',
      body: JSON.stringify({
        id,
        household_id: household.householdId,
        baby_id: household.babyId,
        type: 'feed_bottle',
        occurred_at: NOW,
        ended_at: null,
        payload: { ml: 120, milk: 'formula' },
        group_id: null,
        created_by: a.user.id,
        updated_by: a.user.id,
        client_created_at: NOW,
      }),
      attempts: 0,
      lastError: null,
      createdAt: NOW,
      notBefore: null,
    });

    // Phone B: its own database, linked, reading its household.
    const { db } = await createMemoryDb();
    const events = createEventsRepository(db, testDeps(NOW));
    const outbox = createOutboxRepository(db);
    for (const [key, value] of [
      [META_KEYS.householdId, household.householdId],
      [META_KEYS.userId, b.user.id],
    ] as const) {
      db.insert(meta).values({ key, value }).run();
    }
    db.insert(meta)
      .values({ key: META_KEYS.localBabyId, value: household.babyId })
      .onConflictDoUpdate({ target: meta.key, set: { value: household.babyId } })
      .run();

    const engine = createPullEngine({
      linked: () => readLinkedIdentity(db),
      events,
      outbox,
      auth: b.auth,
      state: { status: 'signedIn', user: b.user },
    });

    // B listens. Nothing else will wake it: no interval, no foreground.
    const warmUpId = newUuid();
    const timedId = newUuid();
    const pings: number[] = [];
    let warmedUp: (() => void) | undefined;
    let arrived: ((at: number) => void) | undefined;
    let joined: (() => void) | undefined;
    const warmUp = new Promise<void>((resolve) => {
      warmedUp = resolve;
    });
    const timed = new Promise<number>((resolve) => {
      arrived = resolve;
    });
    const subscribed = new Promise<void>((resolve) => {
      joined = resolve;
    });
    const watch = watchHousehold(b.auth, household.householdId, {
      onPing: () => {
        pings.push(Date.now());
        void engine.pull().then(() => {
          if (events.get(warmUpId)) warmedUp?.();
          if (events.get(timedId)) arrived?.(Date.now());
        });
      },
      onConnected: () => joined?.(),
    });

    const impatient = <T>(work: Promise<T>, ms: number, complaint: string) =>
      Promise.race([
        work,
        new Promise<T>((_, reject) => setTimeout(() => reject(new Error(complaint)), ms)),
      ]);

    await subscribed;
    await engine.pull(); // start from what is already there (nothing)
    expect(events.list()).toEqual([]);

    // One entry to wake the subscription, not timed.
    expect(await pushOps(a.auth, [bottleFrom(warmUpId)])).toMatchObject([{ status: 'applied' }]);
    await impatient(warmUp, WARM_UP_MS, 'the subscription never woke up');
    const settled = pings.length;

    // The one that counts.
    const sentAt = Date.now();
    expect(await pushOps(a.auth, [bottleFrom(timedId)])).toMatchObject([{ status: 'applied' }]);
    const at = await impatient(timed, BUDGET_MS, 'phone B heard nothing in time');

    expect(at - sentAt).toBeLessThan(BUDGET_MS);
    expect(pings.length).toBeGreaterThan(settled); // it was told, not found by chance
    expect(events.get(timedId)).toMatchObject({ payload: { ml: 120, milk: 'formula' } });
    console.log(`phone B had it ${at - sentAt}ms after phone A sent it`);

    watch.close();
    for (const p of [a, b]) {
      await p.auth.signOut();
      p.auth.setForeground(false);
      // The socket outlives the channel, and would hold the process open.
      await p.auth.client.realtime.disconnect();
    }
  });
});
