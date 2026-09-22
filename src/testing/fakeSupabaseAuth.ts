/// <reference types="node" />
// Test-only: a keychain that outlives any one app process, and Supabase as
// far as email OTP sign in and household setup need it, so both can be tested
// end to end without a server.
import type { SecureKeyValueStore } from '@/sync/chunkedStorage';

export const TEST_SUPABASE_ENV = {
  url: 'http://127.0.0.1:55321',
  publishableKey: 'sb_publishable_test',
};
export const USER_ID = '6f1c1e0a-1111-4222-8333-444455556666';
export const EMAIL = 'parent@example.test';
export const HOUR_S = 3600;

/** A SecureStore that outlives any one client, as the keychain outlives the app process. */
export function keychain() {
  const items = new Map<string, string>();
  const store: SecureKeyValueStore = {
    getItemAsync: async (key) => items.get(key) ?? null,
    setItemAsync: async (key, value) => {
      if (new TextEncoder().encode(value).length > 2048) throw new Error('value too large');
      items.set(key, value);
    },
    deleteItemAsync: async (key) => {
      items.delete(key);
    },
  };
  return { store, items };
}

const b64 = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
export function session(expiresAt: number) {
  return {
    access_token: `${b64({ alg: 'HS256' })}.${b64({ sub: USER_ID, exp: expiresAt, role: 'authenticated' })}.sig`,
    token_type: 'bearer',
    expires_in: expiresAt - Math.floor(Date.now() / 1000),
    expires_at: expiresAt,
    // Long enough, with the user below, that the stored session needs several pieces.
    refresh_token: 'r'.repeat(40),
    user: {
      id: USER_ID,
      aud: 'authenticated',
      role: 'authenticated',
      email: EMAIL,
      app_metadata: { provider: 'email', providers: ['email'] },
      user_metadata: { note: 'x'.repeat(2500) },
      created_at: new Date().toISOString(),
    },
  };
}

export type Call = { path: string; body: Record<string, unknown> };

/** Supabase Auth, as far as email OTP needs it. */
export type ServerBaby = { id: string; name: string; household_id: string };

export function authServer(
  options: {
    verify?: () => Response;
    /** Babies the signed-in account can already see (a household made elsewhere). */
    babies?: ServerBaby[];
    createHousehold?: () => Response;
  } = {},
) {
  const calls: Call[] = [];
  const fetchImpl = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    const body = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : {};
    calls.push({ path: url.pathname, body });
    const json = (status: number, value: unknown) =>
      new Response(JSON.stringify(value), {
        status,
        headers: { 'content-type': 'application/json' },
      });
    switch (url.pathname) {
      case '/auth/v1/otp':
        return json(200, {});
      case '/auth/v1/verify':
        return options.verify?.() ?? json(200, session(Math.floor(Date.now() / 1000) + HOUR_S));
      case '/auth/v1/logout':
        return new Response(null, { status: 204 });
      case '/rest/v1/babies':
        return json(200, options.babies ?? []);
      case '/rest/v1/rpc/create_household':
        return options.createHousehold?.() ?? new Response(null, { status: 204 });
      default:
        return json(404, { code: 'not_found' });
    }
  });
  return { fetchImpl: fetchImpl as unknown as typeof fetch, calls };
}

export const offline = (async () => {
  throw new TypeError('Network request failed');
}) as unknown as typeof fetch;
