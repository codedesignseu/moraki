import { fireEvent, screen, waitFor } from 'expo-router/testing-library';
import { Share } from 'react-native';

import { outbox } from '@/db/schema';
import { readIdentity } from '@/db/identity';
import { createAuth } from '@/sync/auth';
import { createHarness, renderApp, type Harness } from '@/testing/appHarness';
import {
  BABY_ID,
  EMAIL,
  HOUSEHOLD_ID,
  TEST_SUPABASE_ENV,
  USER_ID,
  authServer,
  keychain,
  offline,
} from '@/testing/fakeSupabaseAuth';

jest.mock('@/ui/deviceTimeZone', () => ({ deviceTimeZone: () => 'Europe/Nicosia' }));

const NOW = Date.parse('2026-10-28T12:00:00Z');
const CODE = 'ABCD2345';

let h: Harness;
beforeEach(async () => {
  h = await createHarness(NOW);
});
afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
});

const press = (name: string | RegExp) => fireEvent.press(screen.getByRole('button', { name }));
const type = (label: string, text: string) =>
  fireEvent.changeText(screen.getByLabelText(label), text);

/** Renders the app already signed in, from the keychain, with no network needed. */
async function signedIn(
  options: Parameters<typeof authServer>[0] = {},
  { initialUrl }: { initialUrl?: string } = {},
) {
  const server = authServer(options);
  const { store } = keychain();
  const signingIn = createAuth(TEST_SUPABASE_ENV, store, server.fetchImpl);
  await signingIn.verifyCode(EMAIL, '123456');
  signingIn.setForeground(false);
  const auth = createAuth(TEST_SUPABASE_ENV, store, server.fetchImpl);
  await renderApp(h.repo, { auth, ...(initialUrl ? { initialUrl } : {}) });
  return server;
}

const owner = {
  babies: [{ id: BABY_ID, name: 'Ella', household_id: HOUSEHOLD_ID }],
  memberships: [{ household_id: HOUSEHOLD_ID, role: 'owner' as const }],
};

describe('inviting a caregiver', () => {
  it('creates a code and shares a link to it', async () => {
    const share = jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction' });
    const server = await signedIn(owner);
    await press(/Settings/);
    await screen.findByText('Household: Ella');
    await press('Invite a caregiver');

    await press('Create invite');
    expect(await screen.findByLabelText('Invite code ABCD-2345')).toBeOnTheScreen();
    expect(screen.getByText(/Works until/)).toBeOnTheScreen();

    await press('Share link');
    expect(share).toHaveBeenCalledWith({
      message: expect.stringContaining('https://moraki.app/join/ABCD2345'),
    });
    expect(share.mock.calls[0]![0]).toMatchObject({
      message: expect.stringContaining('ABCD-2345'),
    });
    expect(server.calls.filter((c) => c.path === '/rest/v1/rpc/create_invite')[0]!.body).toEqual({
      household_id: HOUSEHOLD_ID,
      role: 'caregiver',
    });
  });

  it('can invite a viewer instead', async () => {
    const server = await signedIn(owner);
    await press(/Settings/);
    await screen.findByText('Household: Ella');
    await press('Invite a caregiver');
    await fireEvent.press(screen.getByRole('radio', { name: 'View only' }));
    expect(screen.getByText('They can see everything but log nothing.')).toBeOnTheScreen();
    await press('Create invite');

    expect(server.calls.filter((c) => c.path === '/rest/v1/rpc/create_invite')[0]!.body).toEqual({
      household_id: HOUSEHOLD_ID,
      role: 'viewer',
    });
  });

  it('refuses a caregiver who opens the invite screen directly', async () => {
    const server = await signedIn(
      { babies: owner.babies, memberships: [{ household_id: HOUSEHOLD_ID, role: 'caregiver' }] },
      { initialUrl: '/invite' },
    );
    expect(
      await screen.findByText('Only the household owner can invite someone.'),
    ).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Create invite' })).toBeNull();
    expect(server.calls.some((c) => c.path === '/rest/v1/rpc/create_invite')).toBe(false);
  });

  it('is offered to the owner only', async () => {
    await signedIn({
      babies: owner.babies,
      memberships: [{ household_id: HOUSEHOLD_ID, role: 'caregiver' }],
    });
    await press(/Settings/);
    await screen.findByText('Household: Ella');
    expect(screen.queryByRole('button', { name: 'Invite a caregiver' })).toBeNull();
  });
});

describe('joining through the link', () => {
  it('joins from the invite link and lands on home with the role it granted', async () => {
    const logged = h.repo.insert({
      type: 'diaper',
      occurredAt: NOW - 3_600_000,
      payload: { kind: 'wet' },
    });
    const identity = readIdentity(h.mem.db);
    const events = h.repo.list();
    const queued = h.mem.db.select().from(outbox).all();

    const server = await signedIn({}, { initialUrl: `/join/${CODE}` });
    expect(await screen.findByLabelText('Invite code')).toHaveProp('value', 'ABCD-2345');

    await type('Your name', ' Nik ');
    await fireEvent.press(screen.getByRole('togglebutton', { name: 'Father' }));
    await press('Join');

    // Home, with this phone's own entries still there and untouched.
    expect(await screen.findByRole('button', { name: 'Log feed' })).toBeOnTheScreen();
    expect(screen.getByTestId(`recent-${logged.id}`)).toBeOnTheScreen();
    expect(readIdentity(h.mem.db)).toEqual(identity);
    expect(h.repo.list()).toEqual(events);
    expect(h.mem.db.select().from(outbox).all()).toEqual(queued);

    expect(server.calls.filter((c) => c.path === '/rest/v1/rpc/accept_invite')[0]!.body).toEqual({
      code: CODE,
      display_name: 'Nik',
      relation: 'father',
    });
    expect(h.prefs.get('accountHousehold')).toEqual({
      userId: USER_ID,
      householdId: HOUSEHOLD_ID,
      babyId: BABY_ID,
      babyName: 'Ella',
      role: 'caregiver',
    });

    await press(/Settings/);
    expect(screen.getByText('Household: Ella')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Invite a caregiver' })).toBeNull();
  });

  it('asks a signed-out phone to sign in first', async () => {
    await renderApp(h.repo, { auth: null, initialUrl: `/join/${CODE}` });
    expect(screen.getByText('Sign in to join this household.')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeOnTheScreen();
  });

  it('joins with a code typed in, however it is written', async () => {
    const server = await signedIn();
    await press(/Settings/);
    await press('Join with a code');
    await type('Invite code', ' abcd-2345 ');
    await type('Your name', 'Nik');
    await press('Join');

    expect(await screen.findByRole('button', { name: 'Log feed' })).toBeOnTheScreen();
    expect(
      server.calls.filter((c) => c.path === '/rest/v1/rpc/accept_invite')[0]!.body,
    ).toMatchObject({ code: CODE });
  });

  it('asks for the code and a name before calling the server', async () => {
    const server = await signedIn();
    await press(/Settings/);
    await press('Join with a code');

    await press('Join');
    expect(screen.getByText('The code is 8 characters.')).toBeOnTheScreen();
    await type('Invite code', CODE);
    await press('Join');
    expect(screen.getByText('Enter your name.')).toBeOnTheScreen();
    expect(server.calls.some((c) => c.path === '/rest/v1/rpc/accept_invite')).toBe(false);
  });

  it.each([
    ['MKI01', 'No invite with that code. Check it, or ask for a new one.'],
    ['MKI02', 'That invite has already been used. Ask for a new one.'],
    ['MKI03', 'That invite has expired. Ask for a new one.'],
    ['MKI04', 'You’re already in a household.'],
  ])('explains %s', async (code, message) => {
    await signedIn(
      {
        acceptInvite: () =>
          new Response(JSON.stringify({ code, message: 'no' }), {
            status: 400,
            headers: { 'content-type': 'application/json' },
          }),
      },
      { initialUrl: `/join/${CODE}` },
    );
    await type('Your name', 'Nik');
    await press('Join');
    expect(await screen.findByText(message)).toBeOnTheScreen();
    await waitFor(() => expect(h.prefs.get('accountHousehold')).toBeNull());
  });

  it('says joining needs a connection', async () => {
    const server = authServer();
    let online = true;
    const flaky = ((input: RequestInfo | URL, init?: RequestInit) =>
      online ? server.fetchImpl(input, init) : offline(input, init)) as typeof fetch;
    const { store } = keychain();
    const signingIn = createAuth(TEST_SUPABASE_ENV, store, flaky);
    await signingIn.verifyCode(EMAIL, '123456');
    signingIn.setForeground(false);
    await renderApp(h.repo, {
      auth: createAuth(TEST_SUPABASE_ENV, store, flaky),
      initialUrl: `/join/${CODE}`,
    });
    await type('Your name', 'Nik');
    online = false;
    await press('Join');

    expect(
      await screen.findByText('You’re offline. Joining needs a connection.'),
    ).toBeOnTheScreen();
  });

  it('says so when this account is already in a household', async () => {
    await signedIn(owner, { initialUrl: `/join/${CODE}` });
    expect(
      await screen.findByText(
        'You’re already in Ella’s household. One household per account for now.',
      ),
    ).toBeOnTheScreen();
  });
});
