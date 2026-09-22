import { cleanup, fireEvent, screen } from 'expo-router/testing-library';

import { createAuth } from '@/sync/auth';
import { createHarness, renderApp, type Harness } from '@/testing/appHarness';
import {
  EMAIL,
  TEST_SUPABASE_ENV,
  authServer,
  keychain,
  offline,
} from '@/testing/fakeSupabaseAuth';

jest.mock('@/ui/deviceTimeZone', () => ({ deviceTimeZone: () => 'Europe/Nicosia' }));

let h: Harness;
beforeEach(async () => {
  h = await createHarness(Date.parse('2026-10-28T12:00:00Z'));
});
afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
});

async function openSettings(auth: ReturnType<typeof createAuth> | null) {
  await renderApp(h.repo, { auth });
  await fireEvent.press(screen.getByRole('button', { name: /Settings/ }));
}
const press = (name: string | RegExp) => fireEvent.press(screen.getByRole('button', { name }));
const type = (label: string, text: string) =>
  fireEvent.changeText(screen.getByLabelText(label), text);

async function signInThroughTheApp(code = '123456') {
  await press('Sign in');
  await type('Email', ` ${EMAIL.toUpperCase()} `);
  await press('Send code');
  expect(
    await screen.findByText(`We sent a 6-digit code to ${EMAIL.toUpperCase()}.`),
  ).toBeOnTheScreen();
  await type('Code', code);
  await press('Sign in');
}

describe('sign in with an emailed code', () => {
  it('signs in from Settings and says who is signed in', async () => {
    const server = authServer();
    await openSettings(createAuth(TEST_SUPABASE_ENV, keychain().store, server.fetchImpl));
    expect(screen.getByText(/Your entries stay on this phone/)).toBeOnTheScreen();

    await signInThroughTheApp();

    expect(await screen.findByText(`Signed in as ${EMAIL}`)).toBeOnTheScreen();
    // The address is trimmed and lower-cased before it's sent.
    const auth = server.calls.filter((c) => c.path.startsWith('/auth/'));
    expect(auth.map((c) => [c.path, c.body.email])).toEqual([
      ['/auth/v1/otp', EMAIL],
      ['/auth/v1/verify', EMAIL],
    ]);
  });

  it('is still signed in after the app is killed and reopened offline', async () => {
    const { store } = keychain();
    await openSettings(createAuth(TEST_SUPABASE_ENV, store, authServer().fetchImpl));
    await signInThroughTheApp();
    expect(await screen.findByText(`Signed in as ${EMAIL}`)).toBeOnTheScreen();

    // Kill: every screen goes away, and nothing held in memory survives but the
    // keychain. Relaunch: new auth, same keychain, no network.
    await cleanup();
    await openSettings(createAuth(TEST_SUPABASE_ENV, store, offline));
    expect(await screen.findByText(`Signed in as ${EMAIL}`)).toBeOnTheScreen();
  });

  it('signs out on this phone, and stays signed out after a restart', async () => {
    const { store } = keychain();
    await openSettings(createAuth(TEST_SUPABASE_ENV, store, authServer().fetchImpl));
    await signInThroughTheApp();
    await press('Sign out');
    expect(await screen.findByRole('button', { name: 'Sign in' })).toBeOnTheScreen();

    await cleanup();
    await openSettings(createAuth(TEST_SUPABASE_ENV, store, offline));
    expect(await screen.findByRole('button', { name: 'Sign in' })).toBeOnTheScreen();
  });

  it('explains a mistyped address, a short code, a wrong code and no connection', async () => {
    const server = authServer({
      verify: () =>
        new Response(JSON.stringify({ code: 'otp_expired' }), {
          status: 403,
          headers: { 'content-type': 'application/json' },
        }),
    });
    await openSettings(createAuth(TEST_SUPABASE_ENV, keychain().store, server.fetchImpl));
    await press('Sign in');

    await type('Email', 'parent@example');
    await press('Send code');
    expect(screen.getByText('Check the email address.')).toBeOnTheScreen();
    expect(server.calls).toEqual([]);

    await type('Email', EMAIL);
    await press('Send code');
    await type('Code', '12a3');
    expect(screen.getByLabelText('Code').props.value).toBe('123');
    await press('Sign in');
    expect(screen.getByText('Enter all 6 digits.')).toBeOnTheScreen();

    await type('Code', '000000');
    await press('Sign in');
    expect(
      await screen.findByText('That code is wrong or has expired. Send a new code to try again.'),
    ).toBeOnTheScreen();
  });

  it('says signing in needs a connection when offline', async () => {
    await openSettings(createAuth(TEST_SUPABASE_ENV, keychain().store, offline));
    await press('Sign in');
    await type('Email', EMAIL);
    await press('Send code');
    expect(
      await screen.findByText("You're offline. Signing in needs a connection."),
    ).toBeOnTheScreen();
  });

  it('offers no sign in when the build has no Supabase settings', async () => {
    await openSettings(null);
    expect(screen.queryByTestId('settings-account')).toBeNull();
    expect(screen.getByText('Night mode')).toBeOnTheScreen();
  });
});
