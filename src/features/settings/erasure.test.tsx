import * as AppleAuthentication from 'expo-apple-authentication';
import { fireEvent, screen, waitFor } from 'expo-router/testing-library';
import { Platform } from 'react-native';

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
jest.mock('expo-apple-authentication', () => ({ signInAsync: jest.fn() }));
const appleSignIn = AppleAuthentication.signInAsync as jest.Mock;
const mockGoogle = {
  configure: jest.fn(),
  hasPreviousSignIn: jest.fn(() => true),
  getCurrentUser: jest.fn(() => ({ user: { id: 'g' } })),
  signInSilently: jest.fn(async () => ({ type: 'success' })),
  revokeAccess: jest.fn(async (): Promise<null> => null),
  signOut: jest.fn(async () => null),
};
jest.mock('@react-native-google-signin/google-signin', () => ({ GoogleSignin: mockGoogle }));

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

const member = (
  userId: string,
  role: string,
  display_name: string,
  minutesAgo: number,
  isGuardian = true,
) => ({
  household_id: HOUSEHOLD,
  user_id: userId,
  role,
  display_name,
  relation: null,
  joined_at: new Date(NOW - minutesAgo * 60_000).toISOString(),
  is_guardian: isGuardian,
});

/** Nik, the other member, has declared they are a parent or guardian unless `nikGuardian` is false. */
const household = (myRole: 'owner' | 'caregiver', withNik = true, nikGuardian = true) => ({
  babies: [{ id: BABY_ID, name: 'Ella', household_id: HOUSEHOLD }],
  memberships: [{ household_id: HOUSEHOLD, role: myRole }],
  caregivers: [
    member(USER_ID, myRole, 'Maria', 120),
    ...(withNik
      ? [member(NIK, myRole === 'owner' ? 'caregiver' : 'owner', 'Nik', 60, nikGuardian)]
      : []),
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

  it('makes the last owner choose who takes over before anything is sent (D3)', async () => {
    const calls: string[] = [];
    await openLeaveOrDelete({
      ...household('owner'),
      erasure: (rpc) => void calls.push(rpc),
    });
    await fireEvent.press(screen.getByRole('button', { name: 'Delete account' }));
    expect(screen.getByText('Who becomes owner?')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Yes, delete my account' })).toBeDisabled();
    await fireEvent.press(screen.getByRole('button', { name: 'Yes, delete my account' }));
    expect(calls).toEqual([]);
  });

  it('offers only members who have declared they are a parent or guardian (P0.1)', async () => {
    await openLeaveOrDelete(household('owner'));
    await fireEvent.press(screen.getByRole('button', { name: 'Delete account' }));
    expect(
      screen.getByText(
        'Only someone who has confirmed they’re the baby’s parent or guardian can become owner.',
      ),
    ).toBeTruthy();
    expect(screen.getByRole('togglebutton', { name: 'Nik' })).toBeTruthy();
  });

  it('with nobody who has declared, offers no leaving and says why (P0.1)', async () => {
    const calls: string[] = [];
    await openLeaveOrDelete({
      ...household('owner', true, false),
      erasure: (rpc) => void calls.push(rpc),
    });
    expect(screen.queryByTestId('erasure-leave')).toBeNull();
    expect(screen.getByTestId('erasure-leave-blocked')).toHaveTextContent(
      /Delete the household, or ask the other parent to confirm it in Settings first/,
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Delete account' }));
    expect(screen.queryByRole('togglebutton', { name: 'Nik' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Yes, delete my account' })).toBeDisabled();
    expect(calls).toEqual([]);
    // Deleting the household stays open to them.
    expect(screen.getByTestId('erasure-deleteHousehold')).toBeTruthy();
  });

  it('asks a caregiver no such question', async () => {
    await openLeaveOrDelete(household('caregiver'));
    await fireEvent.press(screen.getByRole('button', { name: 'Leave household' }));
    expect(screen.queryByText('Who becomes owner?')).toBeNull();
    expect(screen.getByRole('button', { name: 'Yes, leave' })).toBeEnabled();
  });

  it('deletes the account, naming the new owner, clears the phone and signs it out', async () => {
    const calls: [string, Record<string, unknown>][] = [];
    await openLeaveOrDelete({
      ...household('owner'),
      erasure: (rpc, body) => void calls.push([rpc, body]),
    });
    await fireEvent.press(screen.getByRole('button', { name: 'Delete account' }));
    await fireEvent.press(screen.getByRole('togglebutton', { name: 'Nik' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Yes, delete my account' }));

    await waitFor(() => expect(calls).toEqual([['delete_account', { successor: NIK }]]));
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

    await waitFor(() =>
      expect(calls).toEqual([
        ['leave_household', { household_id: HOUSEHOLD, successor: null, locale: 'en' }],
      ]),
    );
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
    await fireEvent.press(screen.getByRole('togglebutton', { name: 'Nik' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Yes, delete my account' }));

    expect(await screen.findByTestId('erasure-problem')).toHaveTextContent(
      /Your role may have changed/,
    );
    expect(h.repo.list()).toHaveLength(1);
    expect(readLinkedIdentity(h.mem.db)).not.toBeNull();
  });
});

describe('deleting an account signed in with Apple (App Store 5.1.1(v))', () => {
  const paths = (server: { calls: { path: string }[] }) =>
    server.calls
      .map((call) => call.path)
      .filter((path) =>
        ['/functions/v1/apple-revoke', '/rest/v1/rpc/delete_account'].includes(path),
      );

  beforeEach(() => appleSignIn.mockReset());
  afterEach(() => jest.restoreAllMocks());

  async function deleteAppleAccount(options: Parameters<typeof authServer>[0] = {}) {
    const server = await openLeaveOrDelete({
      ...household('owner', false),
      providers: ['apple'],
      ...options,
    });
    await fireEvent.press(screen.getByRole('button', { name: 'Delete account' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Yes, delete my account' }));
    return server;
  }

  it('confirms with Apple, revokes the tokens, then deletes the account', async () => {
    appleSignIn.mockResolvedValue({ authorizationCode: 'fresh-code' });
    const revoked: Record<string, unknown>[] = [];
    const server = await deleteAppleAccount({ appleRevoke: (body) => void revoked.push(body) });

    await waitFor(() => expect(h.repo.list()).toEqual([]));
    expect(appleSignIn).toHaveBeenCalledWith({ requestedScopes: [] });
    expect(revoked).toEqual([{ authorizationCode: 'fresh-code' }]);
    expect(paths(server)).toEqual(['/functions/v1/apple-revoke', '/rest/v1/rpc/delete_account']);
  });

  it("deletes nothing when the person closes Apple's sheet, and says why", async () => {
    appleSignIn.mockRejectedValue(
      Object.assign(new Error('canceled'), { code: 'ERR_REQUEST_CANCELED' }),
    );
    const server = await deleteAppleAccount();

    expect(await screen.findByTestId('erasure-problem')).toHaveTextContent(
      /Apple needs to confirm before your account is deleted/,
    );
    expect(paths(server)).toEqual([]);
    expect(h.repo.list()).toHaveLength(1);
    expect(readLinkedIdentity(h.mem.db)).not.toBeNull();
  });

  it("deletes nothing when Apple's tokens cannot be revoked, so the person can retry", async () => {
    appleSignIn.mockResolvedValue({ authorizationCode: 'fresh-code' });
    const server = await deleteAppleAccount({
      appleRevoke: () =>
        new Response(JSON.stringify({ error: 'invalid_code' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }),
    });

    expect(await screen.findByTestId('erasure-problem')).toHaveTextContent(
      /Couldn't disconnect your account from Sign in with Apple/,
    );
    expect(paths(server)).toEqual(['/functions/v1/apple-revoke']);
    expect(h.repo.list()).toHaveLength(1);
  });

  it('asks nothing of an account that never used Apple', async () => {
    const server = await deleteAppleAccount({ providers: ['email'] });

    await waitFor(() => expect(h.repo.list()).toEqual([]));
    expect(appleSignIn).not.toHaveBeenCalled();
    expect(paths(server)).toEqual(['/rest/v1/rpc/delete_account']);
  });

  it('deletes without Apple off iOS, where Apple has no native sheet', async () => {
    jest.replaceProperty(Platform, 'OS', 'android');
    const server = await deleteAppleAccount();

    await waitFor(() => expect(h.repo.list()).toEqual([]));
    expect(appleSignIn).not.toHaveBeenCalled();
    expect(paths(server)).toEqual(['/rest/v1/rpc/delete_account']);
  });
});

describe('deleting an account signed in with Google (P0.10)', () => {
  const env = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
  beforeEach(() => {
    process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID = 'web-client.apps.googleusercontent.com';
    for (const fn of Object.values(mockGoogle)) fn.mockClear();
  });
  afterEach(() => {
    process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID = env;
  });

  async function deleteGoogleAccount(options: Parameters<typeof authServer>[0] = {}) {
    const server = await openLeaveOrDelete({
      ...household('owner', false),
      providers: ['google'],
      ...options,
    });
    await fireEvent.press(screen.getByRole('button', { name: 'Delete account' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Yes, delete my account' }));
    return server;
  }

  it('deletes the account, then revokes Google access and signs Google out', async () => {
    const server = await deleteGoogleAccount();

    await waitFor(() => expect(h.repo.list()).toEqual([]));
    expect(server.calls.map((call) => call.path)).toContain('/rest/v1/rpc/delete_account');
    expect(mockGoogle.revokeAccess).toHaveBeenCalledTimes(1);
    expect(mockGoogle.signOut).toHaveBeenCalledTimes(1);
  });

  it('still deletes the account when Google refuses to revoke', async () => {
    mockGoogle.revokeAccess.mockRejectedValueOnce(new Error('NETWORK_ERROR'));
    await deleteGoogleAccount();

    await waitFor(() => expect(h.repo.list()).toEqual([]));
    expect(screen.queryByTestId('erasure-problem')).toBeNull();
    expect(readLinkedIdentity(h.mem.db)).toBeNull();
  });

  it('leaves Google alone when the account never used it', async () => {
    await deleteGoogleAccount({ providers: ['email'] });

    await waitFor(() => expect(h.repo.list()).toEqual([]));
    expect(mockGoogle.configure).not.toHaveBeenCalled();
    expect(mockGoogle.revokeAccess).not.toHaveBeenCalled();
  });
});
