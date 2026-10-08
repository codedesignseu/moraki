import { act, fireEvent, screen, waitFor } from 'expo-router/testing-library';

import { readLinkedIdentity } from '@/db/identity';
import { META_KEYS } from '@/db/meta';
import { events, meta, outbox } from '@/db/schema';
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

const NOW = Date.parse('2026-10-28T12:00:00Z');
const CODE = 'ABCD2345';
/** The account that used this phone before, signed out keeping its entries (D6). */
const FIRST = {
  userId: '0190a0b0-0000-7000-8000-0000000000c1',
  householdId: '0190a0b0-0000-7000-8000-0000000000a9',
  babyId: '0190a0b0-0000-7000-8000-0000000000b9',
};

let h: Harness;
beforeEach(async () => {
  h = await createHarness(NOW);
});
afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
});

/** The first account's household on this phone, with one entry still unsent. */
function keptFromFirstAccount() {
  for (const [key, value] of [
    [META_KEYS.householdId, FIRST.householdId],
    [META_KEYS.userId, FIRST.userId],
    [META_KEYS.localBabyId, FIRST.babyId],
  ] as const) {
    h.mem.db
      .insert(meta)
      .values({ key, value })
      .onConflictDoUpdate({ target: meta.key, set: { value } })
      .run();
  }
  h.repo.forgetIdentity();
  return h.repo.insert({ type: 'diaper', occurredAt: NOW - 3_600_000, payload: { kind: 'wet' } });
}

/** Signed in as a different account, which has a household of its own (or none yet). */
async function openAsSecondAccount(member: 'owner' | null, initialUrl?: string) {
  const fake = authServer({
    babies: [{ id: BABY_ID, name: 'Ella', household_id: HOUSEHOLD_ID }],
    memberships: member ? [{ household_id: HOUSEHOLD_ID, role: member }] : [],
    events: () => [],
  });
  const { store } = keychain();
  const signingIn = createAuth(TEST_SUPABASE_ENV, store, fake.fetchImpl);
  await signingIn.verifyCode(EMAIL, '123456');
  signingIn.setForeground(false);
  await renderApp(h.repo, {
    auth: createAuth(TEST_SUPABASE_ENV, store, fake.fetchImpl),
    ...(initialUrl ? { initialUrl } : {}),
  });
  await act(async () => {
    h.prefs.set('consent', { userId: USER_ID, version: '2026-09-23', grantedAt: NOW });
  });
  return fake;
}

const pushed = (fake: ReturnType<typeof authServer>) =>
  fake.calls.filter((call) => call.path === '/rest/v1/rpc/push_events');

/** The entry, as stored: still the first account's, in the first household. */
const stored = (id: string) =>
  h.mem.db
    .select()
    .from(events)
    .all()
    .find((row) => row.id === id);

describe('a phone holding another account’s entries (P5-F11)', () => {
  it('keeps them out of the new account’s household, and says so', async () => {
    const mine = keptFromFirstAccount();
    const fake = await openAsSecondAccount('owner');
    await act(async () => {
      jest.advanceTimersByTime(61_000);
    });

    expect(stored(mine.id)).toMatchObject({
      householdId: FIRST.householdId,
      babyId: FIRST.babyId,
      createdBy: FIRST.userId,
    });
    expect(readLinkedIdentity(h.mem.db)).toEqual({
      householdId: FIRST.householdId,
      userId: FIRST.userId,
    });
    for (const op of h.mem.db.select().from(outbox).all()) {
      expect(op.body).not.toContain(HOUSEHOLD_ID);
    }
    expect(pushed(fake)).toHaveLength(0);

    await fireEvent.press(screen.getByRole('button', { name: /Settings/ }));
    expect(await screen.findByTestId('settings-other-account')).toBeOnTheScreen();
  });

  it('starts clean in the new household once the phone is cleared', async () => {
    const mine = keptFromFirstAccount();
    await openAsSecondAccount('owner');
    await fireEvent.press(screen.getByRole('button', { name: /Settings/ }));
    await fireEvent.press(await screen.findByRole('button', { name: 'Clear this phone' }));

    await waitFor(() =>
      expect(readLinkedIdentity(h.mem.db)).toEqual({ householdId: HOUSEHOLD_ID, userId: USER_ID }),
    );
    expect(stored(mine.id)).toBeUndefined();
    expect(screen.queryByTestId('settings-other-account')).toBeNull();
  });

  it('accepting an invite as another account neither asks to move them nor moves them', async () => {
    const mine = keptFromFirstAccount();
    await openAsSecondAccount(null, `/join/${CODE}`);
    await fireEvent.changeText(await screen.findByLabelText('Your name'), 'Nik');
    await fireEvent.press(screen.getByRole('button', { name: 'Join' }));
    await waitFor(() => expect(h.prefs.get('accountHousehold')).not.toBeNull());

    await fireEvent.press(await screen.findByRole('button', { name: /Settings/ }));
    expect(await screen.findByTestId('settings-other-account')).toBeOnTheScreen();
    expect(screen.queryByTestId('settings-local-entries')).toBeNull();
    // Even an earlier "add them" answer does not take another account's entries.
    await act(async () => {
      h.prefs.set('localEntries', 'move');
    });
    expect(stored(mine.id)).toMatchObject({ householdId: FIRST.householdId });
  });

  it('signing back in as the same account carries on, with nothing to clear', async () => {
    for (const [key, value] of [
      [META_KEYS.householdId, HOUSEHOLD_ID],
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
    const mine = h.repo.insert({ type: 'diaper', occurredAt: NOW, payload: { kind: 'wet' } });
    const fake = await openAsSecondAccount('owner');

    await waitFor(() => expect(pushed(fake).length).toBeGreaterThan(0));
    expect(stored(mine.id)).toMatchObject({ householdId: HOUSEHOLD_ID, createdBy: USER_ID });
    await fireEvent.press(screen.getByRole('button', { name: /Settings/ }));
    expect(screen.queryByTestId('settings-other-account')).toBeNull();
  });
});
