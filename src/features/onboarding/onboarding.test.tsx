import { fireEvent, screen, waitFor } from 'expo-router/testing-library';

import { readIdentity } from '@/db/identity';
import { outbox } from '@/db/schema';
import { createAuth } from '@/sync/auth';
import { createHarness, renderApp, type Harness } from '@/testing/appHarness';
import {
  EMAIL,
  TEST_SUPABASE_ENV,
  USER_ID,
  authServer,
  keychain,
  offline,
  type ServerBaby,
} from '@/testing/fakeSupabaseAuth';

jest.mock('@/ui/deviceTimeZone', () => ({ deviceTimeZone: () => 'Europe/Nicosia' }));
jest.mock('expo-crypto', () => ({
  getRandomBytes: (n: number) => crypto.getRandomValues(new Uint8Array(n)),
}));

const NOW = Date.parse('2026-10-28T12:00:00Z'); // Wednesday 14:00 in Nicosia
const UUID_V7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

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

/** Opens the app, signs in through Settings, and stays on Settings. */
async function signedIn(options: Parameters<typeof authServer>[0] = {}, fetchImpl?: typeof fetch) {
  const server = authServer(options);
  const { store } = keychain();
  const auth = createAuth(TEST_SUPABASE_ENV, store, fetchImpl ?? server.fetchImpl);
  await renderApp(h.repo, { auth });
  await press(/Settings/);
  await press('Sign in');
  await type('Email', EMAIL);
  await press('Send code');
  await type('Code', '123456');
  await press('Sign in');
  // Signing in leads to the consent screen (P3-09); agreeing goes back.
  await press('I agree');
  await screen.findByText(`Signed in as ${EMAIL}`);
  return server;
}

async function fillIn() {
  await type('Your name', ' Maria ');
  await fireEvent.press(screen.getByRole('togglebutton', { name: 'Mother' }));
  await type('Baby’s name', ' Ella ');
  // Two days ago, through the Stepper's accessibility action, as VoiceOver does.
  for (let i = 0; i < 2; i += 1) {
    await fireEvent(screen.getByRole('adjustable', { name: 'Born' }), 'accessibilityAction', {
      nativeEvent: { actionName: 'increment' },
    });
  }
  await type('Birth weight in grams (optional)', '3400');
}

describe('household setup', () => {
  it('a new user ends on home with an empty baby', async () => {
    const server = await signedIn();
    expect(screen.getByText(/Add your baby to create a household/)).toBeOnTheScreen();

    await press('Set up your household');
    await fillIn();
    expect(screen.getByText('Born on Monday 26 October')).toBeOnTheScreen();
    await press('Create household');

    // Home, with nothing logged.
    expect(await screen.findByRole('button', { name: 'Log feed' })).toBeOnTheScreen();
    expect(screen.getByText('Nothing logged yet')).toBeOnTheScreen();

    // One call made the household, the owner membership and the baby.
    const calls = server.calls.filter((c) => c.path === '/rest/v1/rpc/create_household');
    expect(calls).toHaveLength(1);
    const body = calls[0]!.body;
    expect(body).toEqual({
      household_id: expect.stringMatching(UUID_V7),
      baby_id: expect.stringMatching(UUID_V7),
      baby_name: 'Ella',
      born_at: '2026-10-26T10:00:00.000Z', // noon in Nicosia, two days ago
      display_name: 'Maria',
      relation: 'mother',
      birth_weight_g: 3400,
    });
    expect(h.prefs.get('accountHousehold')).toEqual({
      userId: USER_ID,
      householdId: body.household_id,
      babyId: body.baby_id,
      babyName: 'Ella',
      // Kept with the record, so the weight view has a day 0 and a baseline
      // without asking the server again (P3-05).
      bornAt: Date.parse('2026-10-26T10:00:00.000Z'),
      birthWeightG: 3400,
      role: 'owner',
    });

    await press(/Settings/);
    expect(screen.getByText('Household: Ella')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Set up your household' })).toBeNull();
  });

  it('keeps entries already on this phone, now belonging to the new household', async () => {
    const logged = h.repo.insert({
      type: 'diaper',
      occurredAt: NOW - 60 * 60_000,
      payload: { kind: 'wet' },
    });
    const before = readIdentity(h.mem.db);
    const queued = h.mem.db.select().from(outbox).all();

    await signedIn();
    await press('Set up your household');
    await fillIn();
    await press('Create household');
    expect(await screen.findByRole('button', { name: 'Log feed' })).toBeOnTheScreen();

    // Setting up a household is what the entries were waiting for (P2-11):
    // same entry, same id, still on screen, now the household's.
    await waitFor(() => expect(h.repo.get(logged.id)?.householdId).not.toBe(before.householdId));
    expect(h.repo.list().map((event) => event.id)).toEqual([logged.id]);
    expect(screen.getByTestId(`recent-${logged.id}`)).toBeOnTheScreen();
    // And it goes to the server, which is what it was waiting for.
    expect(queued).toHaveLength(1);
    await waitFor(() => expect(h.mem.db.select().from(outbox).all()).toEqual([]));
  });

  it('finds a household the account already has, and makes no second one', async () => {
    const baby: ServerBaby = {
      id: '0190a0b0-0000-7000-8000-000000000001',
      name: 'Leo',
      household_id: '0190a0b0-0000-7000-8000-000000000002',
    };
    const server = await signedIn({
      babies: [baby],
      memberships: [{ household_id: baby.household_id, role: 'caregiver' }],
    });

    // Settings asks the server once, in the background, and remembers it.
    expect(await screen.findByText('Household: Leo')).toBeOnTheScreen();
    expect(h.prefs.get('accountHousehold')).toEqual({
      userId: USER_ID,
      householdId: baby.household_id,
      babyId: baby.id,
      babyName: 'Leo',
      role: 'caregiver',
    });
    expect(server.calls.some((c) => c.path === '/rest/v1/rpc/create_household')).toBe(false);
  });

  it('asks for the missing details before calling the server', async () => {
    const server = await signedIn();
    await press('Set up your household');

    await press('Create household');
    expect(screen.getByText('Enter your name.')).toBeOnTheScreen();
    await type('Your name', 'Maria');
    await press('Create household');
    expect(screen.getByText('Enter your baby’s name.')).toBeOnTheScreen();
    await type('Baby’s name', 'Ella');
    await type('Birth weight in grams (optional)', '34');
    await press('Create household');
    expect(
      screen.getByText('Enter a weight between 500 and 7000 grams, or leave it empty.'),
    ).toBeOnTheScreen();

    expect(server.calls.some((c) => c.path === '/rest/v1/rpc/create_household')).toBe(false);
  });

  it('says a household needs a connection, and records nothing', async () => {
    const server = authServer();
    // Online to sign in; the connection drops before the household is created.
    let online = true;
    const flaky = ((input: RequestInfo | URL, init?: RequestInit) =>
      online ? server.fetchImpl(input, init) : offline(input, init)) as typeof fetch;
    await signedIn({}, flaky);
    await press('Set up your household');
    await fillIn();
    online = false;
    await press('Create household');

    expect(
      await screen.findByText('You’re offline. Setting up a household needs a connection.'),
    ).toBeOnTheScreen();
    await waitFor(() => expect(h.prefs.get('accountHousehold')).toBeNull());
  });

  it('ignores another account’s household record on this phone', async () => {
    h.prefs.set('accountHousehold', {
      userId: '0190a0b0-0000-7000-8000-00000000ffff',
      householdId: '0190a0b0-0000-7000-8000-00000000fffe',
      babyId: '0190a0b0-0000-7000-8000-00000000fffd',
      babyName: 'Someone else',
      role: 'owner',
    });
    await signedIn();
    expect(screen.queryByText('Household: Someone else')).toBeNull();
    expect(screen.getByRole('button', { name: 'Set up your household' })).toBeOnTheScreen();
  });
});
