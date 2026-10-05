import { fireEvent, screen, waitFor } from 'expo-router/testing-library';

import { CONSENT_VERSION } from '@/privacy/useConsent';
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

const NOW = Date.parse('2026-10-28T12:00:00Z');

let h: Harness;
beforeEach(async () => {
  h = await createHarness(NOW);
});
afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
});

/** Signed in, no household yet, two entries that exist only on this phone. */
async function openSettings() {
  const server = authServer({ events: () => [] });
  const { store } = keychain();
  const signingIn = createAuth(TEST_SUPABASE_ENV, store, server.fetchImpl);
  await signingIn.verifyCode(EMAIL, '123456');
  signingIn.setForeground(false);
  h.prefs.set('consent', { userId: USER_ID, version: CONSENT_VERSION, grantedAt: NOW });
  h.repo.insert({ type: 'diaper', occurredAt: NOW - 120_000, payload: { kind: 'wet' } });
  h.repo.insert({ type: 'diaper', occurredAt: NOW - 60_000, payload: { kind: 'dirty' } });

  await renderApp(h.repo, { auth: createAuth(TEST_SUPABASE_ENV, store, server.fetchImpl) });
  await fireEvent.press(await screen.findByRole('button', { name: /Settings/ }));
  await fireEvent.press(await screen.findByRole('button', { name: 'Sign out' }));
  await screen.findByTestId('settings-sign-out');
}

describe('signing out (P5-F1, D6)', () => {
  it('asks first, and says what clearing would lose', async () => {
    await openSettings();
    expect(screen.getByText(/2 changes haven't reached the server yet/)).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByTestId('settings-sign-out')).toBeNull();
    expect(screen.getByText(`Signed in as ${EMAIL}`)).toBeTruthy();
  });

  it('keeps the entries when asked to', async () => {
    await openSettings();
    await fireEvent.press(screen.getByRole('button', { name: 'Sign out, keep entries' }));
    expect(await screen.findByRole('button', { name: 'Sign in' })).toBeTruthy();
    expect(h.repo.list()).toHaveLength(2);
    expect(h.prefs.get('consent')).not.toBeNull();
  });

  it('clears the phone when asked to', async () => {
    await openSettings();
    await fireEvent.press(screen.getByRole('button', { name: 'Sign out and clear this phone' }));
    expect(await screen.findByRole('button', { name: 'Sign in' })).toBeTruthy();
    await waitFor(() => expect(h.repo.list()).toEqual([]));
    expect(h.prefs.get('consent')).toBeNull();
  });
});
