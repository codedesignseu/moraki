import { act, screen, waitFor } from 'expo-router/testing-library';

import { META_KEYS } from '@/db/meta';
import { CONSENT_VERSION } from '@/privacy/useConsent';
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
import type { watchHousehold } from './realtime';

jest.mock('@/ui/deviceTimeZone', () => ({ deviceTimeZone: () => 'Europe/Nicosia' }));

const NOW = Date.parse('2026-10-28T12:00:00Z');
const HOUSEHOLD = '0190a0b0-0000-7000-8000-0000000000a1';
const OTHER = '0190a0b0-0000-7000-8000-00000000000c';

let h: Harness;
beforeEach(async () => {
  h = await createHarness(NOW);
  // The point of a ping is that no timer has to fire, so this file lets the
  // clock run: a fake one would hide a wait rather than prove there isn't one.
  jest.useRealTimers();
});
afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
});

function link(babyId: string) {
  h.mem.db.insert(meta).values({ key: META_KEYS.householdId, value: HOUSEHOLD }).run();
  h.mem.db.insert(meta).values({ key: META_KEYS.userId, value: USER_ID }).run();
  // Nothing is sent for an account that hasn't agreed to health data being
  // processed (P3-09), so a linked phone has agreed.
  h.prefs.set('consent', { userId: USER_ID, version: CONSENT_VERSION, grantedAt: Date.now() });
  h.mem.db
    .insert(meta)
    .values({ key: META_KEYS.localBabyId, value: babyId })
    .onConflictDoUpdate({ target: meta.key, set: { value: babyId } })
    .run();
}

const theirBottle = (seq: number, babyId: string) => ({
  id: `e-${seq}`,
  household_id: HOUSEHOLD,
  baby_id: babyId,
  type: 'feed_bottle',
  occurred_at: new Date(NOW - 20 * 60_000).toISOString(),
  ended_at: null,
  payload: { ml: 150, milk: 'formula' },
  group_id: null,
  created_by: OTHER,
  updated_by: OTHER,
  client_created_at: new Date(NOW - 20 * 60_000).toISOString(),
  server_updated_at: new Date(NOW).toISOString(),
  deleted_at: null,
  seq,
});

/** Stands in for the subscription, so a test can ping the app. */
function fakeWatch() {
  const watched: { households: string[]; closed: number } = { households: [], closed: 0 };
  let ping: (() => void) | undefined;
  let connected: (() => void) | undefined;
  const watch: typeof watchHousehold = (_auth, householdId, handlers) => {
    watched.households.push(householdId);
    ping = handlers.onPing;
    connected = handlers.onConnected;
    return {
      close: () => {
        watched.closed += 1;
      },
    };
  };
  return { watch, watched, ping: () => ping?.(), connected: () => connected?.() };
}

async function openApp(options: Parameters<typeof authServer>[0], watch?: typeof watchHousehold) {
  const server = authServer(options);
  const { store } = keychain();
  const signingIn = createAuth(TEST_SUPABASE_ENV, store, server.fetchImpl);
  await signingIn.verifyCode(EMAIL, '123456');
  signingIn.setForeground(false);
  await renderApp(h.repo, {
    auth: createAuth(TEST_SUPABASE_ENV, store, server.fetchImpl),
    ...(watch ? { watch } : {}),
  });
  return server;
}

describe('hearing about the other phone', () => {
  it('reads the household as soon as it is told something changed', async () => {
    const mine = h.repo.insert({
      type: 'diaper',
      occurredAt: NOW - 60 * 60_000,
      payload: { kind: 'wet' },
    });
    link(mine.babyId);
    const realtime = fakeWatch();

    // Nothing to read at first; their bottle appears only after the ping.
    let theirs: unknown[] = [];
    await openApp({ events: () => theirs }, realtime.watch);
    await waitFor(() => expect(realtime.watched.households).toEqual([HOUSEHOLD]));
    expect(screen.queryByText('150 mL formula')).toBeNull();

    theirs = [theirBottle(30, mine.babyId)];
    await act(async () => {
      realtime.ping();
    });

    // No timer was wound on: the ping alone brought it in.
    expect(await screen.findByText('150 mL formula')).toBeOnTheScreen();
    await waitFor(() => expect(h.outbox.cursor()).toBe(30));
    expect(realtime.watched.households).toEqual([HOUSEHOLD]); // still the one subscription
  });

  it('does not listen for a phone that has not joined a household yet', async () => {
    h.repo.insert({ type: 'diaper', occurredAt: NOW, payload: { kind: 'wet' } });
    const realtime = fakeWatch();
    await openApp({}, realtime.watch);

    // Signed in, but still on its own ids: the same gate as sending and reading.
    await waitFor(() => expect(h.outbox.pending()).toBe(1));
    expect(realtime.watched.households).toEqual([]);
  });

  it('sends and reads again as soon as the connection is back, without waiting out the backoff', async () => {
    const mine = h.repo.insert({
      type: 'diaper',
      occurredAt: NOW - 60_000,
      payload: { kind: 'wet' },
    });
    link(mine.babyId);
    const realtime = fakeWatch();

    let reachable = false;
    const server = authServer({ events: () => [] });
    const { store } = keychain();
    const signingIn = createAuth(TEST_SUPABASE_ENV, store, server.fetchImpl);
    await signingIn.verifyCode(EMAIL, '123456');
    signingIn.setForeground(false);
    const flaky = ((input: RequestInfo | URL, init?: RequestInit) => {
      if (!reachable && String(input).includes('push_events')) {
        return Promise.reject(new TypeError('Network request failed'));
      }
      return server.fetchImpl(input, init);
    }) as typeof fetch;
    await renderApp(h.repo, {
      auth: createAuth(TEST_SUPABASE_ENV, store, flaky),
      watch: realtime.watch,
    });

    // The entry can't be sent while the connection is down.
    await waitFor(() => expect(h.outbox.pending()).toBe(1));

    reachable = true;
    await act(async () => {
      realtime.connected(); // the channel joined again
    });
    await waitFor(() => expect(h.outbox.pending()).toBe(0));
  });
});
