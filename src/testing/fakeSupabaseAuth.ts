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
export const WEEK_MS = 7 * 24 * 3600_000;
/** The household a fake invite joins. */
export const HOUSEHOLD_ID = '0190a0b0-0000-7000-8000-0000000000a1';
export const BABY_ID = '0190a0b0-0000-7000-8000-0000000000b1';

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
    /** The account's membership, if it has one. Defaults to owner of the babies' household. */
    memberships?: { household_id: string; role: 'owner' | 'caregiver' | 'viewer' }[];
    createInvite?: () => Response;
    pushEvents?: (ops: { op: string; body: { id: string } }[]) => Response;
    /** Rows a pull finds; `seq` is the PostgREST filter, e.g. "gt.7". */
    events?: (seq: string) => unknown[];
    acceptInvite?: () => Response;
    createHousehold?: () => Response;
  } = {},
) {
  const calls: Call[] = [];
  const fetchImpl = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    const body = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : {};
    calls.push({ path: url.pathname, body });
    // PostgREST returns a bare object, not a list, when the client asks for one.
    const headers = new Headers(init?.headers ?? {});
    const single = /vnd\.pgrst\.object/.test(headers.get('accept') ?? '');
    const one = (row: unknown) => (single ? row : [row]);
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
      case '/rest/v1/events': {
        // The real table only returns rows after the cursor (SDD 5.3), and a
        // fake that forgets that would let a pull repeat itself for ever.
        const after = Number(/gt\.(\d+)/.exec(url.searchParams.get('seq') ?? '')?.[1] ?? 0);
        const rows = (options.events?.(url.searchParams.get('seq') ?? '') ?? []) as {
          seq?: number;
        }[];
        return json(
          200,
          rows.filter((row) => (row.seq ?? 0) > after),
        );
      }
      case '/rest/v1/babies':
        return json(200, options.babies ?? []);
      case '/rest/v1/memberships':
        return json(
          200,
          options.memberships ??
            (options.babies ?? []).map((baby) => ({
              household_id: baby.household_id,
              role: 'owner',
            })),
        );
      case '/rest/v1/rpc/push_events': {
        const ops = (body.ops ?? []) as { op: string; body: { id: string } }[];
        return (
          options.pushEvents?.(ops) ??
          json(
            200,
            ops.map((entry) => ({
              id: entry.body.id,
              op: entry.op,
              status: 'applied',
              reason: null,
            })),
          )
        );
      }
      case '/rest/v1/rpc/create_invite':
        return (
          options.createInvite?.() ??
          json(
            200,
            one({ code: 'ABCD2345', expires_at: new Date(Date.now() + WEEK_MS).toISOString() }),
          )
        );
      case '/rest/v1/rpc/accept_invite':
        return (
          options.acceptInvite?.() ??
          json(
            200,
            one({
              household_id: HOUSEHOLD_ID,
              role: 'caregiver',
              baby_id: BABY_ID,
              baby_name: 'Ella',
            }),
          )
        );
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
