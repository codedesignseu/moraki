import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { chunkedStorage, type SecureKeyValueStore } from './chunkedStorage';
import type { SupabaseEnv } from './supabaseEnv';

export type AuthUser = { id: string; email: string | null };

/** Why a request failed, in terms the sign-in screen can explain. Never carries the address or code. */
export type AuthFailure = 'invalid_code' | 'rate_limited' | 'offline' | 'server' | 'unknown';

export class AuthError extends Error {
  override name = 'AuthError';
  constructor(readonly reason: AuthFailure) {
    super(`Sign in failed: ${reason}`);
  }
}

/** Where the session lives in SecureStore. Fixed, so the app can read it without the client. */
export const AUTH_STORAGE_KEY = 'moraki.auth';

type Storage = ReturnType<typeof chunkedStorage>;

/** The client with its session in SecureStore, split into pieces (SDD 8). */
export function createSupabaseClient(
  env: SupabaseEnv,
  storage: Storage,
  fetchImpl?: typeof fetch,
): SupabaseClient {
  return createClient(env.url, env.publishableKey, {
    auth: {
      storage,
      storageKey: AUTH_STORAGE_KEY,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
    ...(fetchImpl ? { global: { fetch: fetchImpl } } : {}),
  });
}

function failure(error: {
  name?: string | undefined;
  status?: number | undefined;
  code?: string | undefined;
}): AuthError {
  // supabase-js reports a request that never reached the server and a server
  // that answered badly as the same kind of error; only the status tells them
  // apart. Status 0 means nothing came back, so the phone is offline. Anything
  // from 500 up is the server itself: a project that can't send the email
  // answers 500, and calling that "offline" sends people to check their wifi.
  if (error.status === 0 || (error.name === 'AuthRetryableFetchError' && !error.status)) {
    return new AuthError('offline');
  }
  if (error.status === 429 || error.code?.startsWith('over_')) return new AuthError('rate_limited');
  if (error.status !== undefined && error.status >= 500) return new AuthError('server');
  if (
    error.code === 'otp_expired' ||
    error.code === 'invalid_credentials' ||
    error.status === 403
  ) {
    return new AuthError('invalid_code');
  }
  return new AuthError('unknown');
}

/**
 * Email OTP sign in (SDD 2, ADR 007): the user asks for a code, then types
 * the six digits from the email. A new address gets an account on first sign
 * in. The session stays in SecureStore until sign out, so it survives an app
 * kill, and a restart without network keeps the user signed in.
 */
export function createAuth(env: SupabaseEnv, store: SecureKeyValueStore, fetchImpl?: typeof fetch) {
  const storage = chunkedStorage(store);
  const client = createSupabaseClient(env, storage, fetchImpl);
  const toUser = (
    user: { id: string; email?: string | null } | null | undefined,
  ): AuthUser | null => (user ? { id: user.id, email: user.email ?? null } : null);

  return {
    /** For sync (P2-07 onwards): requests made with it carry the signed-in user's token. */
    client,

    async requestCode(email: string): Promise<void> {
      const { error } = await client.auth.signInWithOtp({
        email,
        options: { shouldCreateUser: true },
      });
      if (error) throw failure(error);
    },

    async verifyCode(email: string, code: string): Promise<AuthUser> {
      const { data, error } = await client.auth.verifyOtp({ email, token: code, type: 'email' });
      if (error) throw failure(error);
      const user = toUser(data.user);
      if (!user) throw new AuthError('unknown');
      return user;
    },

    /**
     * Apple and Google sign in (P5-04): the native SDK on the phone does the
     * actual authentication and hands back an ID token, which this exchanges
     * for a Supabase session. `nonce` only applies to Apple — Supabase
     * verifies the token against it (see `features/auth/socialSignIn.ts`).
     */
    async signInWithIdToken(
      provider: 'apple' | 'google',
      idToken: string,
      nonce?: string,
    ): Promise<AuthUser> {
      const { data, error } = await client.auth.signInWithIdToken({
        provider,
        token: idToken,
        ...(nonce ? { nonce } : {}),
      });
      if (error) throw failure(error);
      const user = toUser(data.user);
      if (!user) throw new AuthError('unknown');
      return user;
    },

    /** Ends this device's session only; other phones stay signed in. */
    async signOut(): Promise<void> {
      await client.auth.signOut({ scope: 'local' });
    },

    /**
     * Who is signed in on this device, read straight from SecureStore. Never
     * touches the network: with an expired token and no connection, the
     * client's getSession() retries its refresh for many seconds, but the user
     * is still signed in until they sign out or the server revokes the session.
     */
    async currentUser(): Promise<AuthUser | null> {
      try {
        const raw = await storage.getItem(AUTH_STORAGE_KEY);
        const stored = raw === null ? null : (JSON.parse(raw) as { user?: AuthUser | null });
        return toUser(stored?.user);
      } catch {
        return null;
      }
    },

    /** Called on sign in, sign out and token refresh. Returns an unsubscribe function. */
    onChange(listener: (user: AuthUser | null) => void): () => void {
      const { data } = client.auth.onAuthStateChange((_event, session) =>
        listener(toUser(session?.user)),
      );
      return () => data.subscription.unsubscribe();
    },

    /** Token refresh runs only while the app is in the foreground (Supabase's advice for mobile). */
    setForeground(active: boolean): void {
      if (active) void client.auth.startAutoRefresh();
      else void client.auth.stopAutoRefresh();
    },
  };
}

export type Auth = ReturnType<typeof createAuth>;
