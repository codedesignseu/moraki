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

import { SocialSignInCancelled } from './socialSignIn';

jest.mock('@/ui/deviceTimeZone', () => ({ deviceTimeZone: () => 'Europe/Nicosia' }));

const mockAppleAvailable = jest.fn().mockResolvedValue(false);
const mockSignInWithApple = jest.fn();
const mockSignInWithGoogle = jest.fn();
jest.mock('./socialSignIn', () => ({
  SocialSignInCancelled: class SocialSignInCancelled extends Error {},
  isAppleSignInAvailable: () => mockAppleAvailable(),
  signInWithApple: () => mockSignInWithApple(),
  signInWithGoogle: (webClientId: string, iosClientId: string | undefined) =>
    mockSignInWithGoogle(webClientId, iosClientId),
}));

const mockGoogleWebClientId = jest.fn(() => undefined as string | undefined);
jest.mock('@/sync/googleEnv', () => ({
  readGoogleWebClientId: () => mockGoogleWebClientId(),
  readGoogleIosClientId: () => 'ios-client-id.apps.googleusercontent.com',
}));

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
    await screen.findByText(`We sent a sign-in code to ${EMAIL.toUpperCase()}.`),
  ).toBeOnTheScreen();
  await type('Code', code);
  await press('Sign in');
  // Signing in leads to the consent screen (P3-09). These tests are about
  // signing in, so they take the same way out a person has: Not now.
  await press('Not now');
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
    await press('Sign out, keep entries');
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
    expect(screen.getByText('Enter the whole code from the email.')).toBeOnTheScreen();

    await type('Code', '000000');
    await press('Sign in');
    expect(
      await screen.findByText('That code is wrong or has expired. Send a new code to try again.'),
    ).toBeOnTheScreen();
  });

  it('takes a longer code, for a project that sends more than six digits', async () => {
    // Supabase allows 6 to 10; ours is set to 6, but a project set to 8 must work.
    const server = authServer();
    await openSettings(createAuth(TEST_SUPABASE_ENV, keychain().store, server.fetchImpl));
    await press('Sign in');
    await type('Email', EMAIL);
    await press('Send code');
    await type('Code', '12345678');
    await press('Sign in');
    await press('Not now'); // the consent screen, as above

    expect(await screen.findByText(`Signed in as ${EMAIL}`)).toBeOnTheScreen();
    expect(server.calls.filter((c) => c.path === '/auth/v1/verify')).toEqual([
      { path: '/auth/v1/verify', body: expect.objectContaining({ token: '12345678' }) },
    ]);
  });

  it('still asks for the rest of a code that is too short', async () => {
    const server = authServer();
    await openSettings(createAuth(TEST_SUPABASE_ENV, keychain().store, server.fetchImpl));
    await press('Sign in');
    await type('Email', EMAIL);
    await press('Send code');
    await type('Code', '1234');
    await press('Sign in');

    expect(screen.getByText('Enter the whole code from the email.')).toBeOnTheScreen();
    expect(server.calls.some((c) => c.path === '/auth/v1/verify')).toBe(false);
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

describe('Sign in with Apple (P5-04)', () => {
  afterEach(() => {
    mockAppleAvailable.mockResolvedValue(false);
    mockSignInWithApple.mockReset();
  });

  it('offers no Apple button where the device says it is unavailable', async () => {
    await openSettings(createAuth(TEST_SUPABASE_ENV, keychain().store, authServer().fetchImpl));
    await press('Sign in');
    expect(screen.queryByRole('button', { name: 'Continue with Apple' })).toBeNull();
  });

  it('signs in with the native identity token, straight to the consent screen', async () => {
    mockAppleAvailable.mockResolvedValue(true);
    mockSignInWithApple.mockResolvedValue({
      identityToken: 'the-identity-token',
      nonce: 'the-raw-nonce',
    });
    const server = authServer();

    await openSettings(createAuth(TEST_SUPABASE_ENV, keychain().store, server.fetchImpl));
    await press('Sign in');
    await screen.findByRole('button', { name: 'Continue with Apple' });
    await press('Continue with Apple');
    await press('Not now'); // the consent screen (P3-09)

    expect(await screen.findByText(`Signed in as ${EMAIL}`)).toBeOnTheScreen();
    expect(server.calls.find((c) => c.path === '/auth/v1/token')).toEqual({
      path: '/auth/v1/token',
      body: expect.objectContaining({
        provider: 'apple',
        id_token: 'the-identity-token',
        nonce: 'the-raw-nonce',
      }),
    });
  });

  it('leaves the sign-in screen exactly as it was when the person dismisses the sheet', async () => {
    mockAppleAvailable.mockResolvedValue(true);
    mockSignInWithApple.mockRejectedValue(new SocialSignInCancelled());

    await openSettings(createAuth(TEST_SUPABASE_ENV, keychain().store, authServer().fetchImpl));
    await press('Sign in');
    await screen.findByRole('button', { name: 'Continue with Apple' });
    await press('Continue with Apple');

    expect(await screen.findByRole('button', { name: 'Continue with Apple' })).toBeOnTheScreen();
    expect(screen.queryByText(/Couldn.t sign in/)).toBeNull();
  });
});

describe('Sign in with Google (P5-04)', () => {
  afterEach(() => {
    mockGoogleWebClientId.mockReturnValue(undefined);
    mockSignInWithGoogle.mockReset();
  });

  it('offers no Google button in a build with no client ID configured', async () => {
    await openSettings(createAuth(TEST_SUPABASE_ENV, keychain().store, authServer().fetchImpl));
    await press('Sign in');
    expect(screen.queryByRole('button', { name: 'Continue with Google' })).toBeNull();
  });

  it('signs in with the native ID token, straight to the consent screen', async () => {
    mockGoogleWebClientId.mockReturnValue('web-client-id.apps.googleusercontent.com');
    mockSignInWithGoogle.mockResolvedValue('the-google-token');
    const server = authServer();

    await openSettings(createAuth(TEST_SUPABASE_ENV, keychain().store, server.fetchImpl));
    await press('Sign in');
    await press('Continue with Google');
    await press('Not now'); // the consent screen (P3-09)

    expect(await screen.findByText(`Signed in as ${EMAIL}`)).toBeOnTheScreen();
    expect(mockSignInWithGoogle).toHaveBeenCalledWith(
      'web-client-id.apps.googleusercontent.com',
      'ios-client-id.apps.googleusercontent.com',
    );
    expect(server.calls.find((c) => c.path === '/auth/v1/token')).toEqual({
      path: '/auth/v1/token',
      body: expect.objectContaining({ provider: 'google', id_token: 'the-google-token' }),
    });
  });

  it('leaves the sign-in screen exactly as it was when the person dismisses the sheet', async () => {
    mockGoogleWebClientId.mockReturnValue('web-client-id');
    mockSignInWithGoogle.mockRejectedValue(new SocialSignInCancelled());

    await openSettings(createAuth(TEST_SUPABASE_ENV, keychain().store, authServer().fetchImpl));
    await press('Sign in');
    await press('Continue with Google');

    expect(await screen.findByRole('button', { name: 'Continue with Google' })).toBeOnTheScreen();
    expect(screen.queryByText(/Couldn.t sign in/)).toBeNull();
  });
});
