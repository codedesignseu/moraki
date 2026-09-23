import { act, fireEvent, screen, waitFor } from 'expo-router/testing-library';

import { META_KEYS } from '@/db/meta';
import { CONSENT_VERSION } from '@/features/privacy/useConsent';
import { meta } from '@/db/schema';
import { createAuth } from '@/sync/auth';
import { createHarness, renderApp, type Harness } from '@/testing/appHarness';
import {
  EMAIL,
  TEST_SUPABASE_ENV,
  USER_ID,
  authServer,
  keychain,
} from '@/testing/fakeSupabaseAuth';

jest.mock('@/ui/deviceTimeZone', () => ({ deviceTimeZone: () => 'Europe/Nicosia' }));

const NOW = Date.parse('2026-10-28T12:00:00Z'); // 14:00 local
const HOUSEHOLD = '0190a0b0-0000-7000-8000-0000000000a1';

let h: Harness;
beforeEach(async () => {
  h = await createHarness(NOW);
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

async function openSettings(options: Parameters<typeof authServer>[0], fetchImpl?: typeof fetch) {
  const server = authServer(options);
  const { store } = keychain();
  const signingIn = createAuth(TEST_SUPABASE_ENV, store, server.fetchImpl);
  await signingIn.verifyCode(EMAIL, '123456');
  signingIn.setForeground(false);
  await renderApp(h.repo, {
    auth: createAuth(TEST_SUPABASE_ENV, store, fetchImpl ?? server.fetchImpl),
  });
  await fireEvent.press(screen.getByRole('button', { name: /Settings/ }));
  return server;
}

describe('the sharing status', () => {
  it('counts what is waiting, and reaches zero once it is sent', async () => {
    const entry = h.repo.insert({ type: 'diaper', occurredAt: NOW, payload: { kind: 'wet' } });
    link(entry.babyId);

    // The connection is down, so the entry waits.
    let reachable = false;
    const server = authServer({ events: () => [] });
    const flaky = ((input: RequestInfo | URL, init?: RequestInit) =>
      !reachable && String(input).includes('push_events')
        ? Promise.reject(new TypeError('Network request failed'))
        : server.fetchImpl(input, init)) as typeof fetch;
    const { store } = keychain();
    const signingIn = createAuth(TEST_SUPABASE_ENV, store, server.fetchImpl);
    await signingIn.verifyCode(EMAIL, '123456');
    signingIn.setForeground(false);
    await renderApp(h.repo, { auth: createAuth(TEST_SUPABASE_ENV, store, flaky) });
    await fireEvent.press(screen.getByRole('button', { name: /Settings/ }));

    expect(await screen.findByText('One entry waiting to send')).toBeOnTheScreen();
    expect(screen.getByText('Nothing sent from this phone yet')).toBeOnTheScreen();

    // Back online: the next try empties the queue, and the screen says so.
    reachable = true;
    await act(async () => {
      jest.advanceTimersByTime(2_000);
    });
    expect(await screen.findByText('Everything is sent')).toBeOnTheScreen();
    expect(screen.getByText('Last sent at 14:00')).toBeOnTheScreen();
    await waitFor(() => expect(h.outbox.pending()).toBe(0));
  });

  it('lists what the server refused, and why', async () => {
    const entry = h.repo.insert({ type: 'diaper', occurredAt: NOW, payload: { kind: 'wet' } });
    link(entry.babyId);
    await openSettings({
      events: () => [],
      pushEvents: (ops) =>
        new Response(
          JSON.stringify(
            ops.map((op) => ({
              id: op.body.id,
              op: op.op,
              status: 'rejected',
              reason: 'forbidden',
            })),
          ),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
    });

    expect(await screen.findByTestId('settings-sync-errors')).toBeOnTheScreen();
    expect(screen.getByText('An entry — this phone wasn’t allowed to send it')).toBeOnTheScreen();
    // Refused ops leave the queue, so they can never hold up what follows.
    await waitFor(() => expect(h.outbox.pending()).toBe(0));
    expect(screen.getByText('Everything is sent')).toBeOnTheScreen();
  });

  it('says nothing is shared yet before the phone joins a household', async () => {
    h.repo.insert({ type: 'diaper', occurredAt: NOW, payload: { kind: 'wet' } });
    await openSettings({ events: () => [] });

    expect(await screen.findByText('Nothing from this phone is shared yet.')).toBeOnTheScreen();
    expect(screen.queryByText(/waiting to send/)).toBeNull();
  });

  it('shows nothing about sharing when signed out', async () => {
    await renderApp(h.repo, { auth: null });
    await fireEvent.press(screen.getByRole('button', { name: /Settings/ }));
    expect(screen.queryByTestId('settings-sync')).toBeNull();
  });
});
