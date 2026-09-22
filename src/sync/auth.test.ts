import { AuthError, createAuth } from './auth';
import type { SecureKeyValueStore } from './chunkedStorage';
import {
  EMAIL,
  HOUR_S,
  USER_ID,
  authServer,
  keychain,
  offline,
  session,
  TEST_SUPABASE_ENV,
} from '@/testing/fakeSupabaseAuth';

const clients: ReturnType<typeof createAuth>[] = [];
function launch(store: SecureKeyValueStore, fetchImpl: typeof fetch) {
  const auth = createAuth(TEST_SUPABASE_ENV, store, fetchImpl);
  auth.setForeground(false);
  clients.push(auth);
  return auth;
}
// The client retries a failed token refresh in the background; fake timers
// keep those retries from outliving the test.
beforeEach(() => {
  jest.useFakeTimers({ advanceTimers: true });
});
afterEach(() => {
  clients.splice(0).forEach((auth) => auth.setForeground(false));
  jest.clearAllTimers();
  jest.useRealTimers();
});

describe('email OTP sign in', () => {
  it('asks for a code for the address, creating the account on first sign in', async () => {
    const server = authServer();
    await launch(keychain().store, server.fetchImpl).requestCode(EMAIL);
    expect(server.calls).toEqual([
      { path: '/auth/v1/otp', body: expect.objectContaining({ email: EMAIL, create_user: true }) },
    ]);
  });

  it('signs in with the emailed code and keeps the session in SecureStore, in pieces', async () => {
    const { store, items } = keychain();
    const server = authServer();
    const user = await launch(store, server.fetchImpl).verifyCode(EMAIL, '123456');

    expect(user).toEqual({ id: USER_ID, email: EMAIL });
    expect(server.calls.at(-1)).toEqual({
      path: '/auth/v1/verify',
      body: expect.objectContaining({ email: EMAIL, token: '123456', type: 'email' }),
    });
    const pieces = [...items.keys()].filter((key) => /\.\d+$/.test(key));
    expect(pieces.length).toBeGreaterThan(1);
  });

  it('is still signed in after the app is killed and reopened with no network', async () => {
    const { store } = keychain();
    await launch(store, authServer().fetchImpl).verifyCode(EMAIL, '123456');

    // A new process: a fresh client, the same keychain, no connection.
    const reopened = launch(store, offline);
    expect(await reopened.currentUser()).toEqual({ id: USER_ID, email: EMAIL });
  });

  it('is still signed in when reopened offline after the access token has expired', async () => {
    const { store } = keychain();
    const expired = Math.floor(Date.now() / 1000) - HOUR_S;
    const server = authServer({
      verify: () =>
        new Response(JSON.stringify(session(expired)), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
    });
    await launch(store, server.fetchImpl).verifyCode(EMAIL, '123456');

    // Overnight in airplane mode: the token can't be refreshed, but the user
    // hasn't signed out, and the refresh token is still in the keychain.
    const reopened = launch(store, offline);
    expect(await reopened.currentUser()).toEqual({ id: USER_ID, email: EMAIL });
  });

  it('is signed out after signing out, and stays signed out after a restart', async () => {
    const { store, items } = keychain();
    const server = authServer();
    const auth = launch(store, server.fetchImpl);
    await auth.verifyCode(EMAIL, '123456');
    await auth.signOut();

    expect(items.size).toBe(0);
    expect(await launch(store, offline).currentUser()).toBeNull();
  });

  it('reports a wrong or expired code, and stores nothing', async () => {
    const { store, items } = keychain();
    const server = authServer({
      verify: () =>
        new Response(
          JSON.stringify({ code: 'otp_expired', msg: 'Token has expired or is invalid' }),
          {
            status: 403,
            headers: { 'content-type': 'application/json' },
          },
        ),
    });
    await expect(launch(store, server.fetchImpl).verifyCode(EMAIL, '000000')).rejects.toEqual(
      new AuthError('invalid_code'),
    );
    expect(items.size).toBe(0);
  });

  it('reports no connection when asking for a code offline', async () => {
    await expect(launch(keychain().store, offline).requestCode(EMAIL)).rejects.toEqual(
      new AuthError('offline'),
    );
  });

  it('reports too many requests', async () => {
    const limited = (async () =>
      new Response(JSON.stringify({ code: 'over_email_send_rate_limit' }), {
        status: 429,
        headers: { 'content-type': 'application/json' },
      })) as unknown as typeof fetch;
    await expect(launch(keychain().store, limited).requestCode(EMAIL)).rejects.toEqual(
      new AuthError('rate_limited'),
    );
  });

  it('never puts the address or the code in an error message', async () => {
    const error = new AuthError('invalid_code');
    expect(error.message).not.toContain(EMAIL);
    expect(error.message).not.toContain('123456');
  });
});
