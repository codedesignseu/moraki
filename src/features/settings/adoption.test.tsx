import { act, fireEvent, screen, waitFor } from 'expo-router/testing-library';

import { readIdentity, readLinkedIdentity } from '@/db/identity';
import { outbox } from '@/db/schema';
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
} from '@/testing/fakeSupabaseAuth';

jest.mock('@/ui/deviceTimeZone', () => ({ deviceTimeZone: () => 'Europe/Nicosia' }));
jest.mock('expo-crypto', () => ({
  getRandomBytes: (n: number) => crypto.getRandomValues(new Uint8Array(n)),
}));

const NOW = Date.parse('2026-10-28T12:00:00Z');

let h: Harness;
beforeEach(async () => {
  h = await createHarness(NOW);
});
afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
});

const press = (name: string | RegExp) => fireEvent.press(screen.getByRole('button', { name }));

/** The household this account already belongs to on the server. */
const belongsTo = (role: 'owner' | 'caregiver') => ({
  babies: [{ id: BABY_ID, name: 'Ella', household_id: HOUSEHOLD_ID }],
  memberships: [{ household_id: HOUSEHOLD_ID, role }],
});

async function openSettings(options: Parameters<typeof authServer>[0]) {
  const server = authServer(options);
  const { store } = keychain();
  const signingIn = createAuth(TEST_SUPABASE_ENV, store, server.fetchImpl);
  await signingIn.verifyCode(EMAIL, '123456');
  signingIn.setForeground(false);
  await renderApp(h.repo, { auth: createAuth(TEST_SUPABASE_ENV, store, server.fetchImpl) });
  await press(/Settings/);
  return server;
}

describe('a phone that was used before it had an account', () => {
  it('keeps its history when the household is its own', async () => {
    const bottle = h.repo.insert({
      type: 'feed_bottle',
      occurredAt: NOW - 3_600_000,
      payload: { ml: 90, milk: 'formula' },
    });
    const diaper = h.repo.insert({ type: 'diaper', occurredAt: NOW, payload: { kind: 'wet' } });
    const before = readIdentity(h.mem.db);

    const server = await openSettings(belongsTo('owner'));
    await screen.findByText('Household: Ella');

    // Nothing was asked, and nothing was lost.
    expect(screen.queryByTestId('settings-local-entries')).toBeNull();
    await waitFor(() => expect(readLinkedIdentity(h.mem.db)).not.toBeNull());
    expect(h.repo.list().map((event) => event.id)).toEqual([diaper.id, bottle.id]);

    // They belong to the household now, logged by this account.
    for (const event of h.repo.list()) {
      expect(event).toMatchObject({
        householdId: HOUSEHOLD_ID,
        babyId: BABY_ID,
        createdBy: USER_ID,
      });
    }
    expect(readIdentity(h.mem.db)).not.toEqual(before);

    // And they go to the server as the household's.
    await waitFor(() => expect(h.outbox.pending()).toBe(0));
    const sent = server.calls.filter((c) => c.path === '/rest/v1/rpc/push_events');
    expect(sent.length).toBeGreaterThan(0);
    const ops = sent.flatMap((call) => call.body.ops as { body: { household_id: string } }[]);
    expect(ops.map((op) => op.body.household_id)).toEqual([HOUSEHOLD_ID, HOUSEHOLD_ID]);
  });

  it('asks before taking entries into someone else’s household, and waits', async () => {
    h.repo.insert({ type: 'diaper', occurredAt: NOW, payload: { kind: 'wet' } });
    const server = await openSettings(belongsTo('caregiver'));

    expect(await screen.findByTestId('settings-local-entries')).toBeOnTheScreen();
    expect(
      screen.getByText(/You logged one entry before joining Ella’s household/),
    ).toBeOnTheScreen();

    // Nothing moved, nothing linked, nothing sent while the question stands.
    expect(readLinkedIdentity(h.mem.db)).toBeNull();
    expect(h.outbox.pending()).toBe(1);
    expect(server.calls.some((c) => c.path === '/rest/v1/rpc/push_events')).toBe(false);
  });

  it('takes them in when the caregiver says so', async () => {
    const entry = h.repo.insert({ type: 'diaper', occurredAt: NOW, payload: { kind: 'wet' } });
    const server = await openSettings(belongsTo('caregiver'));
    await screen.findByTestId('settings-local-entries');

    await act(async () => {
      await press('Add them to the household');
    });

    await waitFor(() => expect(readLinkedIdentity(h.mem.db)).not.toBeNull());
    expect(h.repo.get(entry.id)).toMatchObject({ householdId: HOUSEHOLD_ID, createdBy: USER_ID });
    expect(screen.queryByTestId('settings-local-entries')).toBeNull();
    await waitFor(() => expect(h.outbox.pending()).toBe(0));
    expect(server.calls.some((c) => c.path === '/rest/v1/rpc/push_events')).toBe(true);
  });

  it('leaves the phone alone when the caregiver says not now', async () => {
    const entry = h.repo.insert({ type: 'diaper', occurredAt: NOW, payload: { kind: 'wet' } });
    const queued = h.mem.db.select().from(outbox).all();
    const before = readIdentity(h.mem.db);
    const server = await openSettings(belongsTo('caregiver'));
    await screen.findByTestId('settings-local-entries');

    await act(async () => {
      await press('Not now');
    });

    // The question is answered and gone; everything else is untouched.
    await waitFor(() => expect(screen.queryByTestId('settings-local-entries')).toBeNull());
    expect(readIdentity(h.mem.db)).toEqual(before);
    expect(readLinkedIdentity(h.mem.db)).toBeNull();
    expect(h.repo.get(entry.id)).toMatchObject({ householdId: before.householdId });
    expect(h.mem.db.select().from(outbox).all()).toEqual(queued);
    expect(server.calls.some((c) => c.path === '/rest/v1/rpc/push_events')).toBe(false);
  });

  it('does not ask a phone that has logged nothing', async () => {
    await openSettings(belongsTo('caregiver'));
    await screen.findByText('Household: Ella');
    expect(screen.queryByTestId('settings-local-entries')).toBeNull();
    await waitFor(() => expect(readLinkedIdentity(h.mem.db)).not.toBeNull());
  });

  it('keeps logging normally once the phone belongs to the household', async () => {
    h.repo.insert({ type: 'diaper', occurredAt: NOW - 60_000, payload: { kind: 'wet' } });
    await openSettings(belongsTo('owner'));
    await waitFor(() => expect(readLinkedIdentity(h.mem.db)).not.toBeNull());

    await press(/Home/);
    await act(async () => {
      await press('Diaper');
    });
    await press('Wet');

    const latest = h.repo.list()[0];
    expect(latest).toMatchObject({
      householdId: HOUSEHOLD_ID,
      babyId: BABY_ID,
      createdBy: USER_ID,
    });
    expect(screen.getByTestId(`recent-${latest!.id}`)).toBeOnTheScreen();
  });
});
