import { fireEvent, screen, waitFor } from 'expo-router/testing-library';

import { META_KEYS } from '@/db/meta';
import { meta } from '@/db/schema';
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

function link(babyId: string) {
  h.mem.db.insert(meta).values({ key: META_KEYS.householdId, value: HOUSEHOLD }).run();
  h.mem.db.insert(meta).values({ key: META_KEYS.userId, value: USER_ID }).run();
  h.mem.db
    .insert(meta)
    .values({ key: META_KEYS.localBabyId, value: babyId })
    .onConflictDoUpdate({ target: meta.key, set: { value: babyId } })
    .run();
}

/** The household as the server has it: me, and the other parent. */
const household = {
  babies: [{ id: BABY_ID, name: 'Ella', household_id: HOUSEHOLD }],
  memberships: [{ household_id: HOUSEHOLD, role: 'owner' as const }],
  caregivers: [
    {
      household_id: HOUSEHOLD,
      user_id: USER_ID,
      role: 'owner',
      display_name: 'Maria',
      relation: 'mother',
      joined_at: new Date(NOW - 86_400_000).toISOString(),
    },
    {
      household_id: HOUSEHOLD,
      user_id: NIK,
      role: 'caregiver',
      display_name: 'Nik',
      relation: 'father',
      joined_at: new Date(NOW - 3_600_000).toISOString(),
    },
  ],
};

const theirEntry = (babyId: string, seq = 12) => ({
  id: 'e-theirs',
  household_id: HOUSEHOLD,
  baby_id: babyId,
  type: 'diaper',
  occurred_at: new Date(NOW - 600_000).toISOString(),
  ended_at: null,
  payload: { kind: 'wet' },
  group_id: null,
  created_by: NIK,
  updated_by: NIK,
  // Logged a moment after mine, so it is the household's newest entry.
  client_created_at: new Date(NOW + 1_000).toISOString(),
  server_updated_at: new Date(NOW).toISOString(),
  deleted_at: null,
  seq,
});

async function openApp(options: Parameters<typeof authServer>[0]) {
  const server = authServer(options);
  const { store } = keychain();
  const signingIn = createAuth(TEST_SUPABASE_ENV, store, server.fetchImpl);
  await signingIn.verifyCode(EMAIL, '123456');
  signingIn.setForeground(false);
  await renderApp(h.repo, { auth: createAuth(TEST_SUPABASE_ENV, store, server.fetchImpl) });
  return server;
}

describe('who logged what', () => {
  it('reads the other caregiver’s name on their entries, and "You" on yours', async () => {
    const mine = h.repo.insert({
      type: 'diaper',
      occurredAt: NOW - 60_000,
      payload: { kind: 'dirty' },
    });
    link(mine.babyId);
    let page = 0;
    await openApp({
      ...household,
      events: () => (page++ === 0 ? [theirEntry(mine.babyId)] : []),
    });

    // Their entry, by name; mine, as me.
    expect(await screen.findByTestId('recent-e-theirs')).toBeOnTheScreen();
    await waitFor(() => expect(screen.getAllByText('Nik').length).toBeGreaterThan(0));
    expect(screen.getByText('You')).toBeOnTheScreen();
    expect(screen.getByText('Last entry by Nik')).toBeOnTheScreen();
  });

  it('names them in the history timeline too', async () => {
    const mine = h.repo.insert({
      type: 'diaper',
      occurredAt: NOW - 60_000,
      payload: { kind: 'wet' },
    });
    link(mine.babyId);
    let page = 0;
    await openApp({
      ...household,
      events: () => (page++ === 0 ? [theirEntry(mine.babyId)] : []),
    });
    await screen.findByTestId('recent-e-theirs');

    await fireEvent.press(screen.getByRole('button', { name: /History/ }));
    await waitFor(() => expect(screen.getAllByText('Nik').length).toBeGreaterThan(0));
    expect(screen.getAllByText('You').length).toBeGreaterThan(0);
  });

  it('lists the household in Settings, with what each person may do', async () => {
    const mine = h.repo.insert({ type: 'diaper', occurredAt: NOW, payload: { kind: 'wet' } });
    link(mine.babyId);
    await openApp({ ...household, events: () => [] });

    await fireEvent.press(screen.getByRole('button', { name: /Settings/ }));
    expect(await screen.findByTestId('settings-caregivers')).toBeOnTheScreen();
    expect(screen.getByText('You — Owner')).toBeOnTheScreen();
    expect(screen.getByText('Nik — Logs entries')).toBeOnTheScreen();
  });

  it('still says "Another caregiver" before this phone knows any names', async () => {
    const mine = h.repo.insert({
      type: 'diaper',
      occurredAt: NOW - 60_000,
      payload: { kind: 'wet' },
    });
    link(mine.babyId);
    let page = 0;
    // The household answers with no caregivers at all.
    await openApp({
      memberships: household.memberships,
      caregivers: [],
      events: () => (page++ === 0 ? [theirEntry(mine.babyId)] : []),
    });

    expect(await screen.findByTestId('recent-e-theirs')).toBeOnTheScreen();
    expect(screen.getByText('Another caregiver')).toBeOnTheScreen();
    expect(screen.queryByText(/Last entry by/)).toBeNull();
  });
});
