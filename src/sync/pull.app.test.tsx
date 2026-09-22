import { act, screen, waitFor } from 'expo-router/testing-library';

import { META_KEYS } from '@/db/meta';
import { meta } from '@/db/schema';
import { createHarness, renderApp, type Harness } from '@/testing/appHarness';
import {
  EMAIL,
  TEST_SUPABASE_ENV,
  USER_ID,
  authServer,
  keychain,
} from '@/testing/fakeSupabaseAuth';

import { createAuth } from './auth';

jest.mock('@/ui/deviceTimeZone', () => ({ deviceTimeZone: () => 'Europe/Nicosia' }));

const NOW = Date.parse('2026-10-28T12:00:00Z');
const HOUSEHOLD = '0190a0b0-0000-7000-8000-0000000000a1';
const OTHER = '0190a0b0-0000-7000-8000-00000000000c';
const iso = (at: number) => new Date(at).toISOString();

let h: Harness;
beforeEach(async () => {
  h = await createHarness(NOW);
});
afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
});

/** What P2-11 will do: this phone belongs to the household it signed in to. */
function link(babyId: string) {
  h.mem.db.insert(meta).values({ key: META_KEYS.householdId, value: HOUSEHOLD }).run();
  h.mem.db.insert(meta).values({ key: META_KEYS.userId, value: USER_ID }).run();
  h.mem.db
    .insert(meta)
    .values({ key: META_KEYS.localBabyId, value: babyId })
    .onConflictDoUpdate({ target: meta.key, set: { value: babyId } })
    .run();
}

/** A bottle the other caregiver logged, as the server hands it back. */
const theirBottle = (seq: number, ml: number, id = 'e-theirs') => ({
  id,
  household_id: HOUSEHOLD,
  baby_id: h.repo.list()[0]?.babyId ?? '0190a0b0-0000-7000-8000-0000000000b1',
  type: 'feed_bottle',
  occurred_at: iso(NOW - 30 * 60_000),
  ended_at: null,
  payload: { ml, milk: 'formula' },
  group_id: null,
  created_by: OTHER,
  updated_by: OTHER,
  client_created_at: iso(NOW - 30 * 60_000),
  server_updated_at: iso(NOW),
  deleted_at: null,
  seq,
});

async function openApp(options: Parameters<typeof authServer>[0] = {}) {
  const server = authServer(options);
  const { store } = keychain();
  const signingIn = createAuth(TEST_SUPABASE_ENV, store, server.fetchImpl);
  await signingIn.verifyCode(EMAIL, '123456');
  signingIn.setForeground(false);
  await renderApp(h.repo, { auth: createAuth(TEST_SUPABASE_ENV, store, server.fetchImpl) });
  return server;
}

describe('the app reading what the other phone logged', () => {
  it('shows an entry from the other caregiver on home', async () => {
    const mine = h.repo.insert({
      type: 'diaper',
      occurredAt: NOW - 60 * 60_000,
      payload: { kind: 'wet' },
    });
    link(mine.babyId);
    // The first page has their bottle; the next page is empty.
    let page = 0;
    await openApp({ events: () => (page++ === 0 ? [theirBottle(12, 120)] : []) });

    expect(await screen.findByText('120 mL formula')).toBeOnTheScreen();
    expect(screen.getByTestId(`recent-${mine.id}`)).toBeOnTheScreen(); // mine is still there
    await waitFor(() => expect(h.outbox.cursor()).toBe(12));
  });

  it('keeps an edit made here that has not been sent yet', async () => {
    const mine = h.repo.insert({
      type: 'feed_bottle',
      occurredAt: NOW - 30 * 60_000,
      payload: { ml: 90, milk: 'formula' },
    });
    link(mine.babyId);

    // Their entry arrives, and pushing is refused, so anything logged here waits.
    let theirs = [theirBottle(12, 120)];
    let asked = 0;
    await openApp({
      events: () => (asked++ % 2 === 0 ? theirs : []),
      pushEvents: () => new Response('no', { status: 503 }),
    });
    await screen.findByText('120 mL formula');

    // Edited here. The op can't be sent, so it is still waiting.
    await act(async () => {
      h.repo.patch('e-theirs', { payload: { ml: 200 } });
    });
    expect(h.outbox.pending()).toBeGreaterThan(0);
    expect(screen.getByText('200 mL formula')).toBeOnTheScreen();

    // The server sends its older amount back, with a correction of its own.
    theirs = [{ ...theirBottle(19, 120), payload: { ml: 120, milk: 'breast' } }];
    asked = 0;
    await act(async () => {
      jest.advanceTimersByTime(60_000); // the safety-net read (SDD 5.4)
    });

    await waitFor(() => expect(h.outbox.cursor()).toBe(19));
    expect(h.repo.get('e-theirs')).toMatchObject({ payload: { ml: 200, milk: 'breast' } });
    // My amount, their correction of the milk.
    expect(await screen.findByText('200 mL breast milk')).toBeOnTheScreen();
    expect(h.outbox.pending()).toBeGreaterThan(0); // the edit is still waiting to be sent
  });
});
