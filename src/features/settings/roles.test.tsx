import { fireEvent, screen, waitFor, within } from 'expo-router/testing-library';

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
const YIAYIA = '0190a0b0-0000-7000-8000-00000000000d';

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

/** Me as owner, plus a caregiver and a viewer. */
const household = (myRole: 'owner' | 'caregiver' = 'owner') => ({
  babies: [{ id: BABY_ID, name: 'Ella', household_id: HOUSEHOLD }],
  memberships: [{ household_id: HOUSEHOLD, role: myRole as 'owner' | 'caregiver' }],
  caregivers: [
    member(USER_ID, myRole, 'Maria', 120),
    member(NIK, 'caregiver', 'Nik', 60),
    member(YIAYIA, 'viewer', 'Yiayia', 30),
  ],
});

async function openSettings(options: Parameters<typeof authServer>[0]) {
  const server = authServer({ events: () => [], ...options });
  const { store } = keychain();
  const signingIn = createAuth(TEST_SUPABASE_ENV, store, server.fetchImpl);
  await signingIn.verifyCode(EMAIL, '123456');
  signingIn.setForeground(false);
  h.prefs.set('consent', { userId: USER_ID, version: CONSENT_VERSION, grantedAt: NOW });
  // Linked, so a pull runs and the caregivers list is filled from the server.
  for (const [key, value] of [
    [META_KEYS.householdId, HOUSEHOLD],
    [META_KEYS.userId, USER_ID],
  ] as const) {
    h.mem.db
      .insert(meta)
      .values({ key, value })
      .onConflictDoUpdate({ target: meta.key, set: { value } })
      .run();
  }
  await renderApp(h.repo, { auth: createAuth(TEST_SUPABASE_ENV, store, server.fetchImpl) });
  await fireEvent.press(await screen.findByRole('button', { name: /Settings/ }));
  await screen.findByTestId('settings-caregivers');
  return server;
}

const row = (userId: string) => within(screen.getByTestId(`caregiver-${userId}`));

describe('managing who can do what', () => {
  it('lets the owner change a caregiver to a viewer', async () => {
    const changed: [string, Record<string, unknown>][] = [];
    await openSettings({
      ...household(),
      updateMembership: (userId, columns) => changed.push([userId, columns]),
    });

    await fireEvent.press(row(NIK).getByRole('radio', { name: 'Views only' }));

    await waitFor(() => expect(changed).toEqual([[NIK, { role: 'viewer' }]]));
  });

  it('shows the change as the server has it, not as the phone guessed', async () => {
    // The server is the record: the list is read back after every change.
    const people = household().caregivers;
    await openSettings({
      ...household(),
      caregivers: people,
      updateMembership: (userId, columns) => {
        const person = people.find((p) => p.user_id === userId);
        if (person) person.role = String(columns.role);
      },
    });
    expect(row(NIK).getByText(/Nik — Logs entries/)).toBeOnTheScreen();

    await fireEvent.press(row(NIK).getByRole('radio', { name: 'Views only' }));

    await waitFor(() => expect(row(NIK).getByText(/Nik — Views only/)).toBeOnTheScreen());
  });

  it('lets the owner remove someone', async () => {
    const removed: string[] = [];
    await openSettings({ ...household(), removeMembership: (userId) => removed.push(userId) });

    await fireEvent.press(row(YIAYIA).getByRole('button', { name: 'Remove Yiayia' }));

    await waitFor(() => expect(removed).toEqual([YIAYIA]));
  });

  it('never offers the owner a way to demote or remove themselves', async () => {
    await openSettings(household());

    // Leaving is its own question (P4-06), with different consequences.
    expect(row(USER_ID).queryByRole('button', { name: /Remove/ })).toBeNull();
    expect(row(USER_ID).queryByRole('radio', { name: 'Views only' })).toBeNull();
  });

  it('offers a caregiver nothing to change', async () => {
    await openSettings(household('caregiver'));

    expect(row(NIK).queryByRole('button', { name: /Remove/ })).toBeNull();
    expect(screen.queryByTestId('roles-problem')).toBeNull();
    // They still see who is in the household, as before.
    expect(within(screen.getByTestId('settings-caregivers')).getByText(/Nik/)).toBeOnTheScreen();
  });

  it('says so when the server refuses, and leaves the list as the server has it', async () => {
    await openSettings({
      ...household(),
      refuseMembership: () =>
        new Response(JSON.stringify({ code: '42501' }), {
          status: 403,
          headers: { 'content-type': 'application/json' },
        }),
    });

    await fireEvent.press(row(NIK).getByRole('radio', { name: 'Views only' }));

    expect(await screen.findByTestId('roles-problem')).toHaveTextContent(
      'Only the household owner can change this.',
    );
    // Nothing was guessed locally: Nik still reads as he does on the server.
    expect(row(NIK).getByText(/Nik — Logs entries/)).toBeOnTheScreen();
  });

  it('says what removing does to their entries', async () => {
    await openSettings(household());
    expect(
      within(screen.getByTestId('settings-caregivers')).getByText(
        /Their entries stay: they are the household’s record/,
      ),
    ).toBeOnTheScreen();
  });
});
