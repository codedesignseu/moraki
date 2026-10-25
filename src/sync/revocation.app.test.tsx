import { act, fireEvent, screen, waitFor, within } from 'expo-router/testing-library';

import { readLinkedIdentity } from '@/db/identity';
import { META_KEYS } from '@/db/meta';
import { meta, outbox } from '@/db/schema';
import { CONSENT_VERSION, TERMS_VERSION } from '@/domain/consent/consent';
import { createAuth } from '@/sync/auth';
import { createHarness, renderApp, type Harness } from '@/testing/appHarness';
import { createFakeNotifications } from '@/testing/fakeNotifications';
import {
  EMAIL,
  TEST_SUPABASE_ENV,
  USER_ID,
  authServer,
  keychain,
} from '@/testing/fakeSupabaseAuth';

jest.mock('@/ui/deviceTimeZone', () => ({ deviceTimeZone: () => 'Europe/Nicosia' }));

const NOW = Date.parse('2026-10-28T12:00:00Z');
const HOUSEHOLD = '0190a0b0-0000-7000-8000-0000000000a1';
const BABY = '0190a0b0-0000-7000-8000-0000000000b1';

let h: Harness;
beforeEach(async () => {
  h = await createHarness(NOW);
});
afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
});

const json = (status: number, value: unknown) =>
  new Response(JSON.stringify(value), {
    status,
    headers: { 'content-type': 'application/json' },
  });

/**
 * A caregiver's phone, linked to its household, with a feed logged (so a
 * reminder is scheduled) and still waiting to be sent, then opened with the
 * server answering `my_membership_status` as given.
 */
async function openPhone(options: Parameters<typeof authServer>[0]) {
  const server = authServer({
    babies: [{ id: BABY, name: 'Ella', household_id: HOUSEHOLD }],
    memberships: [{ household_id: HOUSEHOLD, role: 'caregiver' }],
    events: () => [],
    ...options,
  });
  const { store } = keychain();
  const signingIn = createAuth(TEST_SUPABASE_ENV, store, server.fetchImpl);
  await signingIn.verifyCode(EMAIL, '123456');
  signingIn.setForeground(false);
  h.prefs.set('terms', { userId: USER_ID, version: TERMS_VERSION });
  h.prefs.set('consent', { userId: USER_ID, version: CONSENT_VERSION, grantedAt: NOW });
  h.prefs.set('reminders', true);
  h.prefs.set('accountHousehold', {
    userId: USER_ID,
    householdId: HOUSEHOLD,
    babyId: BABY,
    babyName: 'Ella',
    role: 'caregiver',
  });
  for (const [key, value] of [
    [META_KEYS.householdId, HOUSEHOLD],
    [META_KEYS.userId, USER_ID],
    [META_KEYS.localBabyId, BABY],
  ] as const) {
    h.mem.db
      .insert(meta)
      .values({ key, value })
      .onConflictDoUpdate({ target: meta.key, set: { value } })
      .run();
  }
  h.repo.forgetIdentity();
  const feed = h.repo.insert({
    type: 'feed_bottle',
    occurredAt: NOW - 30 * 60_000,
    payload: { ml: 90, milk: 'formula' },
  });
  const os = createFakeNotifications();
  await renderApp(h.repo, {
    auth: createAuth(TEST_SUPABASE_ENV, store, server.fetchImpl),
    notifications: os,
  });
  return { server, os, feed };
}

/** The server no longer shows the account a membership or a baby. */
const gone = { memberships: [], babies: [] };

const pushed = (server: ReturnType<typeof authServer>) =>
  server.calls.some((c) => c.path === '/rest/v1/rpc/push_events');

describe('a phone that lost access to its household (P0.5)', () => {
  it('is cleared when the server says it is no longer a member, keeps the account signed in, and says so once', async () => {
    const { server, os, feed } = await openPhone({
      membershipStatus: () => ({ status: 'not_member' }),
      ...gone,
    });

    expect(await screen.findByText('You’re no longer in this household')).toBeOnTheScreen();
    expect(
      within(screen.getByTestId('removed-notice')).getByText(/You were removed from the household/),
    ).toBeOnTheScreen();
    // Everything of the household is gone from the phone, the queue too.
    expect(h.repo.get(feed.id)).toBeNull();
    expect(h.mem.db.select().from(outbox).all()).toEqual([]);
    expect(readLinkedIdentity(h.mem.db)).toBeNull();
    expect(h.prefs.get('accountHousehold')).toBeNull();
    // Nothing stale was sent on its way out.
    expect(pushed(server)).toBe(false);
    // And with the entries, the reminder computed from them.
    await waitFor(() => expect(os.held()).toEqual([]));

    // Still signed in: only the household went.
    expect(h.prefs.get('consent')).not.toBeNull();
    expect(server.calls.some((c) => c.path === '/auth/v1/logout')).toBe(false);

    await fireOk();
    await waitFor(() => expect(h.prefs.get('revokedNotice')).toBeNull());
    expect(screen.queryByText('You’re no longer in this household')).toBeNull();
  });

  it('is cleared when the household was deleted', async () => {
    const { feed } = await openPhone({
      membershipStatus: () => ({ status: 'household_gone' }),
      ...gone,
    });
    expect(await screen.findByText(/The household was deleted/)).toBeOnTheScreen();
    expect(h.repo.get(feed.id)).toBeNull();
  });

  it('signs out too when the account itself was deleted on another phone', async () => {
    const { server, feed } = await openPhone({
      membershipStatus: () => ({ status: 'household_gone' }),
      ...gone,
      user: () =>
        json(403, {
          code: 403,
          error_code: 'user_not_found',
          msg: 'User from sub claim in JWT does not exist',
        }),
    });
    expect(await screen.findByText(/This account was deleted/)).toBeOnTheScreen();
    expect(h.repo.get(feed.id)).toBeNull();
    await waitFor(() => expect(server.calls.some((c) => c.path === '/auth/v1/logout')).toBe(true));
    expect(h.prefs.get('consent')).toBeNull();
  });

  it.each([
    ['a server error', () => json(500, { message: 'boom' })],
    ['a refusal it can’t read', () => json(401, { code: 'PGRST301', message: 'JWT expired' })],
    ['an answer that isn’t clear', () => json(200, [])],
  ])('never clears anything on %s', async (_what, answer) => {
    const { os, feed } = await openPhone({ membershipStatus: answer });
    await waitFor(() => expect(os.held()).toHaveLength(1));
    // Several tries' worth: the phone keeps everything, reminders included.
    await act(async () => {
      await jest.advanceTimersByTimeAsync(5_000);
    });
    expect(h.repo.get(feed.id)).not.toBeNull();
    expect(readLinkedIdentity(h.mem.db)).toEqual({ householdId: HOUSEHOLD, userId: USER_ID });
    expect(h.prefs.get('revokedNotice')).toBeNull();
    expect(os.held()).toHaveLength(1);
  });

  it('never clears anything when the phone is offline', async () => {
    const { feed } = await openPhone({
      membershipStatus: () => {
        throw new TypeError('Network request failed');
      },
    });
    await act(async () => {
      await jest.advanceTimersByTimeAsync(5_000);
    });
    expect(h.repo.get(feed.id)).not.toBeNull();
    expect(h.prefs.get('revokedNotice')).toBeNull();
  });
});

const fireOk = () => fireEvent.press(screen.getByRole('button', { name: 'OK' }));
