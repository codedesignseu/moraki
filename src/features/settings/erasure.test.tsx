import { fireEvent, screen, waitFor } from 'expo-router/testing-library';

import { readLinkedIdentity } from '@/db/identity';
import { META_KEYS } from '@/db/meta';
import { meta } from '@/db/schema';
import { CONSENT_VERSION } from '@/privacy/useConsent';
import { createAuth } from '@/sync/auth';
import { createHarness, renderApp, type Harness } from '@/testing/appHarness';
import {
  BABY_ID,
  EMAIL,
  TEST_SUPABASE_ENV,
  USER_ID,
  authServer,
  keychain,
} from '@/testing/fakeSupabaseAuth';

jest.mock('@/ui/deviceTimeZone', () => ({ deviceTimeZone: () => 'Europe/Nicosia' }));

const NOW = Date.parse('2026-10-28T12:00:00Z');
const HOUSEHOLD = '0190a0b0-0000-7000-8000-0000000000a1';
const NIK = '0190a0b0-0000-7000-8000-00000000000c';

let h: Harness;
beforeEach(async () => {
  h = await createHarness(NOW);
});
afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
});

const member = (userId: string, role: string, display_name: string, minutesAgo: number) => ({
  household_id: HOUSEHOLD,
  user_id: userId,
  role,
  display_name,
  relation: null,
  joined_at: new Date(NOW - minutesAgo * 60_000).toISOString(),
});

const household = (myRole: 'owner' | 'caregiver', withNik = true) => ({
  babies: [{ id: BABY_ID, name: 'Ella', household_id: HOUSEHOLD }],
  memberships: [{ household_id: HOUSEHOLD, role: myRole }],
  caregivers: [
    member(USER_ID, myRole, 'Maria', 120),
    ...(withNik ? [member(NIK, myRole === 'owner' ? 'caregiver' : 'owner', 'Nik', 60)] : []),
  ],
});

/** Signed in, linked to the household, with one entry logged on this phone. */
async function openLeaveOrDelete(options: Parameters<typeof authServer>[0]) {
  const server = authServer({ events: () => [], ...options });
  const { store } = keychain();
  const signingIn = createAuth(TEST_SUPABASE_ENV, store, server.fetchImpl);
  await signingIn.verifyCode(EMAIL, '123456');
  signingIn.setForeground(false);
  h.prefs.set('consent', { userId: USER_ID, version: CONSENT_VERSION, grantedAt: NOW });
  for (const [key, value] of [
    [META_KEYS.householdId, HOUSEHOLD],
    [META_KEYS.userId, USER_ID],
    [META_KEYS.localBabyId, BABY_ID],
  ] as const) {
    h.mem.db
      .insert(meta)
      .values({ key, value })
      .onConflictDoUpdate({ target: meta.key, set: { value } })
      .run();
  }
  h.repo.forgetIdentity();
  h.repo.insert({ type: 'diaper', occurredAt: NOW - 60_000, payload: { kind: 'wet' } });

  await renderApp(h.repo, { auth: createAuth(TEST_SUPABASE_ENV, store, server.fetchImpl) });
  await fireEvent.press(await screen.findByRole('button', { name: /Settings/ }));
  await screen.findByTestId('settings-caregivers');
  await fireEvent.press(screen.getByRole('button', { name: 'Leave or delete' }));
  await screen.findByTestId('erasure-deleteAccount');
  return server;
}

describe('leaving and deleting (P4-06)', () => {
  it('offers the owner of a shared household all three', async () => {
    await openLeaveOrDelete(household('owner'));
    expect(screen.getByTestId('erasure-leave')).toBeTruthy();
    expect(screen.getByTestId('erasure-deleteHousehold')).toBeTruthy();
    expect(screen.getByText(/You leave Ella's household; its entries stay/)).toBeTruthy();
  });

  it('offers a caregiver no household deletion', async () => {
    await openLeaveOrDelete(household('caregiver'));
    expect(screen.getByTestId('erasure-leave')).toBeTruthy();
    expect(screen.queryByTestId('erasure-deleteHousehold')).toBeNull();
  });

  it('tells the only member their household goes with the account, and offers no leaving', async () => {
    await openLeaveOrDelete(household('owner', false));
    expect(screen.queryByTestId('erasure-leave')).toBeNull();
    expect(screen.getByText(/and Ella's household with every entry/)).toBeTruthy();
  });

  it('sends nothing until the second tap, and nothing at all on cancel', async () => {
    const calls: string[] = [];
    await openLeaveOrDelete({
      ...household('owner'),
      erasure: (rpc) => void calls.push(rpc),
    });
    await fireEvent.press(screen.getByRole('button', { name: 'Delete account' }));
    expect(screen.getByText("This can't be undone.")).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByText("This can't be undone.")).toBeNull();
    expect(calls).toEqual([]);
  });

  it('deletes the account, clears the phone and signs it out', async () => {
    const calls: string[] = [];
    await openLeaveOrDelete({
      ...household('owner'),
      erasure: (rpc) => void calls.push(rpc),
    });
    await fireEvent.press(screen.getByRole('button', { name: 'Delete account' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Yes, delete my account' }));

    await waitFor(() => expect(calls).toEqual(['delete_account']));
    await waitFor(() => expect(h.repo.list()).toEqual([]));
    expect(readLinkedIdentity(h.mem.db)).toBeNull();
    expect(h.prefs.get('consent')).toBeNull();

    await fireEvent.press(await screen.findByRole('button', { name: /Settings/ }));
    expect(await screen.findByRole('button', { name: 'Sign in' })).toBeTruthy();
  });

  it('leaves the household with its id, and clears the phone', async () => {
    const calls: [string, Record<string, unknown>][] = [];
    const mine = household('caregiver');
    await openLeaveOrDelete({
      ...mine,
      erasure: (rpc, body) => {
        calls.push([rpc, body]);
        // As on the server: once left, the account belongs to no household.
        mine.memberships.length = 0;
        mine.babies.length = 0;
        return undefined;
      },
    });
    await fireEvent.press(screen.getByRole('button', { name: 'Leave household' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Yes, leave' }));

    await waitFor(() => expect(calls).toEqual([['leave_household', { household_id: HOUSEHOLD }]]));
    await waitFor(() => expect(h.repo.list()).toEqual([]));
    expect(readLinkedIdentity(h.mem.db)).toBeNull();
    // Still signed in: leaving is not deleting the account.
    expect(h.prefs.get('consent')).not.toBeNull();
  });

  it('deletes the household for everyone', async () => {
    const calls: [string, Record<string, unknown>][] = [];
    await openLeaveOrDelete({
      ...household('owner'),
      erasure: (rpc, body) => void calls.push([rpc, body]),
    });
    await fireEvent.press(screen.getByRole('button', { name: 'Delete household' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Yes, delete for everyone' }));

    await waitFor(() => expect(calls).toEqual([['delete_household', { household_id: HOUSEHOLD }]]));
    await waitFor(() => expect(h.repo.list()).toEqual([]));
  });

  it('keeps everything on the phone when the server refuses', async () => {
    await openLeaveOrDelete({
      ...household('owner'),
      erasure: () =>
        new Response(JSON.stringify({ code: '42501', message: 'no' }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        }),
    });
    await fireEvent.press(screen.getByRole('button', { name: 'Delete account' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Yes, delete my account' }));

    expect(await screen.findByTestId('erasure-problem')).toHaveTextContent(
      /Your role may have changed/,
    );
    expect(h.repo.list()).toHaveLength(1);
    expect(readLinkedIdentity(h.mem.db)).not.toBeNull();
  });
});
