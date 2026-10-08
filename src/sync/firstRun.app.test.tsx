import { act, fireEvent, screen, waitFor } from 'expo-router/testing-library';

import { readLinkedIdentity } from '@/db/identity';
import { createAuth, type Auth } from '@/sync/auth';
import { createHarness, renderApp, type Harness } from '@/testing/appHarness';
import {
  BABY_ID,
  EMAIL,
  HOUSEHOLD_ID,
  TEST_SUPABASE_ENV,
  USER_ID,
  authServer,
  keychain,
} from '@/testing/fakeSupabaseAuth';

jest.mock('@/ui/deviceTimeZone', () => ({ deviceTimeZone: () => 'Europe/Nicosia' }));

const NOW = Date.parse('2026-10-28T12:00:00Z');
const OTHER = '0190a0b0-0000-7000-8000-00000000000c';
const CODE = 'ABCD2345';
const iso = (at: number) => new Date(at).toISOString();

let h: Harness;
beforeEach(async () => {
  h = await createHarness(NOW);
});
afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
});

/** A bottle the household already has, as a pull hands it back. */
const theirBottle = {
  id: '0190a0b0-0000-7000-8000-0000000000e1',
  household_id: HOUSEHOLD_ID,
  baby_id: BABY_ID,
  type: 'feed_bottle',
  occurred_at: iso(NOW - 30 * 60_000),
  ended_at: null,
  payload: { ml: 120, milk: 'formula' },
  group_id: null,
  created_by: OTHER,
  updated_by: OTHER,
  client_created_at: iso(NOW - 30 * 60_000),
  server_updated_at: iso(NOW),
  deleted_at: null,
  seq: 12,
};

/** The account's household on the server, with one entry in it. */
function server(member: 'owner' | 'caregiver' | null) {
  return authServer({
    babies: [{ id: BABY_ID, name: 'Ella', household_id: HOUSEHOLD_ID }],
    memberships: member ? [{ household_id: HOUSEHOLD_ID, role: member }] : [],
    events: () => [theirBottle],
  });
}

/** The app opened with a session already in the keychain. */
async function openSignedIn(fake: ReturnType<typeof authServer>, initialUrl?: string) {
  const { store } = keychain();
  const signingIn = createAuth(TEST_SUPABASE_ENV, store, fake.fetchImpl);
  await signingIn.verifyCode(EMAIL, '123456');
  signingIn.setForeground(false);
  await renderApp(h.repo, {
    auth: createAuth(TEST_SUPABASE_ENV, store, fake.fetchImpl),
    ...(initialUrl ? { initialUrl } : {}),
  });
}

/** The app opened signed out; the returned auth signs in while it runs. */
async function openSignedOut(fake: ReturnType<typeof authServer>): Promise<Auth> {
  const { store } = keychain();
  const auth = createAuth(TEST_SUPABASE_ENV, store, fake.fetchImpl);
  await renderApp(h.repo, { auth });
  return auth;
}

const grantConsent = () =>
  act(async () => {
    h.prefs.set('consent', { userId: USER_ID, version: '2026-09-23', grantedAt: NOW });
  });

/*
 * TestFlight build 2: a phone that got its household after launch kept
 * showing an empty home and history until it was restarted. Linking ran only
 * while Settings was open, and a link that moved no entries left the events
 * repository listing the placeholder baby.
 */
describe('a phone that gets its household while the app is open', () => {
  it('pulls and shows the household on home once consent is given, Settings never opened', async () => {
    await openSignedIn(server('caregiver'));
    await grantConsent();

    expect(await screen.findByText('120 mL formula')).toBeOnTheScreen();
    expect(readLinkedIdentity(h.mem.db)).toEqual({ householdId: HOUSEHOLD_ID, userId: USER_ID });
  });

  it('shows home and history after consent is given on its screen', async () => {
    await openSignedIn(server('caregiver'));
    await fireEvent.press(screen.getByRole('button', { name: /Settings/ }));
    await fireEvent.press(await screen.findByRole('button', { name: 'Health data' }));
    await fireEvent.press(await screen.findByRole('button', { name: 'I agree' }));
    await waitFor(() => expect(h.prefs.get('consent')).not.toBeNull());

    await fireEvent.press(screen.getByRole('button', { name: /Home/ }));
    expect(await screen.findByText('120 mL formula')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: /History/ }));
    expect(await screen.findByText('120 mL formula')).toBeOnTheScreen();
  });

  it('first sign in on a phone with entries of its own: both show, no restart', async () => {
    const mine = h.repo.insert({
      type: 'diaper',
      occurredAt: NOW - 60 * 60_000,
      payload: { kind: 'wet' },
    });
    const auth = await openSignedOut(server('owner'));
    expect(await screen.findByTestId(`recent-${mine.id}`)).toBeOnTheScreen();

    await act(async () => {
      await auth.verifyCode(EMAIL, '123456');
    });
    await grantConsent();

    expect(await screen.findByText('120 mL formula')).toBeOnTheScreen();
    expect(screen.getByTestId(`recent-${mine.id}`)).toBeOnTheScreen();
    expect(h.repo.get(mine.id)).toMatchObject({ householdId: HOUSEHOLD_ID, babyId: BABY_ID });
  });

  it('signing in again after clearing the phone on sign out', async () => {
    const auth = await openSignedOut(server('caregiver'));
    await act(async () => {
      await auth.verifyCode(EMAIL, '123456');
    });
    await grantConsent();
    expect(await screen.findByText('120 mL formula')).toBeOnTheScreen();

    // Sign out and clear the phone (P5-F1), then sign in again.
    await fireEvent.press(screen.getByRole('button', { name: /Settings/ }));
    await fireEvent.press(await screen.findByRole('button', { name: 'Sign out' }));
    await fireEvent.press(
      await screen.findByRole('button', { name: 'Sign out and clear this phone' }),
    );
    await waitFor(() => expect(readLinkedIdentity(h.mem.db)).toBeNull());
    expect(h.repo.list()).toHaveLength(0);

    await act(async () => {
      await auth.verifyCode(EMAIL, '123456');
    });
    await grantConsent();
    await fireEvent.press(screen.getByRole('button', { name: /Home/ }));
    expect(await screen.findByText('120 mL formula')).toBeOnTheScreen();
  });

  it('a second caregiver accepting an invite sees the household on home', async () => {
    await openSignedIn(server(null), `/join/${CODE}`);
    await fireEvent.changeText(await screen.findByLabelText('Your name'), 'Nik');
    await fireEvent.press(screen.getByRole('button', { name: 'Join' }));
    await grantConsent();

    expect(await screen.findByText('120 mL formula')).toBeOnTheScreen();
    expect(readLinkedIdentity(h.mem.db)).toEqual({ householdId: HOUSEHOLD_ID, userId: USER_ID });
  });
});
