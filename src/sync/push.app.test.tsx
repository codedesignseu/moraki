import { act, fireEvent, screen, waitFor } from 'expo-router/testing-library';

import { META_KEYS } from '@/db/meta';
import { CONSENT_VERSION } from '@/features/privacy/useConsent';
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

let h: Harness;
beforeEach(async () => {
  h = await createHarness(NOW);
});
afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
});

/** What P2-11 will do: point this phone at the household and user it signed in as. */
function link(userId = USER_ID) {
  h.mem.db.insert(meta).values({ key: META_KEYS.householdId, value: HOUSEHOLD }).run();
  h.mem.db.insert(meta).values({ key: META_KEYS.userId, value: userId }).run();
  // Nothing is sent for an account that hasn't agreed to health data being
  // processed (P3-09), so a linked phone has agreed.
  h.prefs.set('consent', { userId, version: CONSENT_VERSION, grantedAt: Date.now() });
}

async function openApp(options: Parameters<typeof authServer>[0] = {}) {
  const server = authServer(options);
  const { store } = keychain();
  const signingIn = createAuth(TEST_SUPABASE_ENV, store, server.fetchImpl);
  await signingIn.verifyCode(EMAIL, '123456');
  signingIn.setForeground(false);
  await renderApp(h.repo, { auth: createAuth(TEST_SUPABASE_ENV, store, server.fetchImpl) });
  return server;
}
const pushes = (server: ReturnType<typeof authServer>) =>
  server.calls.filter((c) => c.path === '/rest/v1/rpc/push_events');

describe('the app pushing what it logs', () => {
  it('sends an entry as soon as it is logged, and empties the outbox', async () => {
    link();
    const server = await openApp();
    await waitFor(() => expect(h.outbox.pending()).toBe(0)); // nothing queued yet

    await act(async () => {
      await fireEvent.press(screen.getByRole('button', { name: 'Diaper' }));
    });
    await fireEvent.press(screen.getByRole('button', { name: 'Wet' }));

    await waitFor(() => expect(pushes(server)).toHaveLength(1));
    const sent = pushes(server)[0]!.body.ops as { op: string; body: { type: string } }[];
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ op: 'insert', body: { type: 'diaper' } });
    await waitFor(() => expect(h.outbox.pending()).toBe(0));
    expect(h.outbox.errors()).toEqual([]);
  });

  it('never sends entries from a phone that was used before signing in (P2-F4)', async () => {
    // No link: this phone's entries still carry the placeholder ids.
    const server = await openApp();
    await act(async () => {
      await fireEvent.press(screen.getByRole('button', { name: 'Diaper' }));
    });
    await fireEvent.press(screen.getByRole('button', { name: 'Wet' }));

    await waitFor(() => expect(h.outbox.pending()).toBe(1));
    expect(pushes(server)).toEqual([]);
    expect(h.outbox.errors()).toEqual([]);
  });
});
