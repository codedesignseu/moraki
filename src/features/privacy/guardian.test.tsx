import { fireEvent, screen, waitFor, within } from 'expo-router/testing-library';

import { META_KEYS } from '@/db/meta';
import { meta } from '@/db/schema';
import { CONSENT_VERSION } from '@/domain/consent/consent';
import { createAuth } from '@/sync/auth';
import { createHarness, renderApp, type Harness } from '@/testing/appHarness';
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
const DECLARATION =
  'I confirm that I am the parent or legal guardian of this child, or otherwise have lawful authority to provide and manage the child’s information in Moraki.';

let h: Harness;
beforeEach(async () => {
  h = await createHarness(NOW);
});
afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
});

/** Signed in, agreed to health data, a member of the household as `role`. */
async function open(role: 'owner' | 'caregiver', options: Parameters<typeof authServer>[0] = {}) {
  const server = authServer({
    events: () => [],
    babies: [{ id: BABY, name: 'Ella', household_id: HOUSEHOLD }],
    memberships: [{ household_id: HOUSEHOLD, role }],
    caregivers: [
      {
        household_id: HOUSEHOLD,
        user_id: USER_ID,
        role,
        display_name: 'Maria',
        relation: null,
        joined_at: new Date(NOW - 60_000).toISOString(),
        is_guardian: role === 'owner',
      },
    ],
    ...options,
  });
  const { store } = keychain();
  const signingIn = createAuth(TEST_SUPABASE_ENV, store, server.fetchImpl);
  await signingIn.verifyCode(EMAIL, '123456');
  signingIn.setForeground(false);
  h.prefs.set('consent', { userId: USER_ID, version: CONSENT_VERSION, grantedAt: NOW });
  h.prefs.set('accountHousehold', {
    userId: USER_ID,
    householdId: HOUSEHOLD,
    babyId: BABY,
    babyName: 'Ella',
    role,
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
  await renderApp(h.repo, { auth: createAuth(TEST_SUPABASE_ENV, store, server.fetchImpl) });
  return server;
}

describe('an owner from before the declaration existed (P0.1)', () => {
  it('is asked once, and their entries wait until they answer', async () => {
    const pushes: unknown[] = [];
    h.repo.insert({ type: 'diaper', occurredAt: NOW - 60_000, payload: { kind: 'wet' } });
    const server = await open('owner', {
      guardianEvents: () => [],
      pushEvents: (ops) => (pushes.push(ops), new Response('[]', { status: 200 })),
    });

    expect(await screen.findByTestId('guardian-declaration')).toHaveTextContent(
      /Your entries wait on this phone until you do/,
    );
    expect(screen.getByRole('checkbox', { name: DECLARATION })).not.toBeChecked();
    expect(h.prefs.get('guardianDeclaration')).toEqual({
      userId: USER_ID,
      householdId: HOUSEHOLD,
      onRecord: false,
    });

    // Confirming without the tick sends nothing.
    await fireEvent.press(screen.getByRole('button', { name: 'Confirm' }));
    expect(
      screen.getByText('Error: Tick the box to confirm you’re the parent or legal guardian.'),
    ).toBeOnTheScreen();
    expect(server.calls.some((c) => c.path === '/rest/v1/rpc/declare_guardian')).toBe(false);
    expect(pushes).toEqual([]);

    await fireEvent.press(screen.getByRole('checkbox', { name: DECLARATION }));
    await fireEvent.press(screen.getByRole('button', { name: 'Confirm' }));

    await waitFor(() =>
      expect(server.calls.find((c) => c.path === '/rest/v1/rpc/declare_guardian')?.body).toEqual({
        household_id: HOUSEHOLD,
        version: '2026-10-24',
        locale: 'en',
      }),
    );
    await waitFor(() => expect(h.prefs.get('guardianDeclaration')?.onRecord).toBe(true));
    await waitFor(() => expect(screen.queryByTestId('guardian-declaration')).toBeNull());
    // Now the entry goes.
    await waitFor(() => expect(pushes).toHaveLength(1));
  });

  it('says why nothing syncs if they close it, and offers it again in Settings', async () => {
    h.repo.insert({ type: 'diaper', occurredAt: NOW - 60_000, payload: { kind: 'wet' } });
    await open('owner', { guardianEvents: () => [] });
    await fireEvent.press(await screen.findByRole('button', { name: 'Not now' }));

    await fireEvent.press(await screen.findByRole('button', { name: /Settings/ }));
    expect(
      within(await screen.findByTestId('settings-sync')).getByText(
        'Sharing is paused until you confirm you’re the baby’s parent or legal guardian.',
      ),
    ).toBeOnTheScreen();
    await fireEvent.press(
      within(screen.getByTestId('settings-guardian')).getByRole('button', {
        name: 'Confirm I’m a parent or guardian',
      }),
    );
    expect(await screen.findByTestId('guardian-declaration')).toBeOnTheScreen();
  });

  it('is not asked when the declaration is already on record', async () => {
    await open('owner', { guardianEvents: () => [{ id: 1 }] });

    await waitFor(() => expect(h.prefs.get('guardianDeclaration')?.onRecord).toBe(true));
    expect(screen.queryByTestId('guardian-declaration')).toBeNull();
  });

  it('sends nothing, and asks nothing, while the server can’t be asked', async () => {
    const pushes: unknown[] = [];
    h.repo.insert({ type: 'diaper', occurredAt: NOW - 60_000, payload: { kind: 'wet' } });
    await open('owner', {
      guardianEvents: () => new Response('{}', { status: 500 }),
      pushEvents: (ops) => (pushes.push(ops), new Response('[]', { status: 200 })),
    });

    expect(await screen.findByRole('button', { name: 'Log feed' })).toBeOnTheScreen();
    expect(screen.queryByTestId('guardian-declaration')).toBeNull();
    expect(h.prefs.get('guardianDeclaration')).toBeNull();
    expect(pushes).toEqual([]);
  });
});

describe('a caregiver who hasn’t declared (P0.1)', () => {
  it('can declare from Settings, so they could take the household over', async () => {
    const server = await open('caregiver');
    await fireEvent.press(await screen.findByRole('button', { name: /Settings/ }));
    const card = within(await screen.findByTestId('settings-guardian'));
    expect(
      card.getByText('Only a parent or legal guardian can take over this household.'),
    ).toBeOnTheScreen();

    await fireEvent.press(card.getByRole('button', { name: 'Confirm I’m a parent or guardian' }));
    await fireEvent.press(await screen.findByRole('checkbox', { name: DECLARATION }));
    await fireEvent.press(screen.getByRole('button', { name: 'Confirm' }));

    await waitFor(() =>
      expect(server.calls.some((c) => c.path === '/rest/v1/rpc/declare_guardian')).toBe(true),
    );
    await waitFor(() => expect(screen.queryByTestId('settings-guardian')).toBeNull());
  });

  it('goes on to health-data consent, which their access rests on from then on', async () => {
    const server = await open('caregiver');
    await fireEvent.press(await screen.findByRole('button', { name: /Settings/ }));
    const card = within(await screen.findByTestId('settings-guardian'));
    await fireEvent.press(card.getByRole('button', { name: 'Confirm I’m a parent or guardian' }));
    await fireEvent.press(await screen.findByRole('checkbox', { name: DECLARATION }));
    await fireEvent.press(screen.getByRole('button', { name: 'Confirm' }));

    expect(await screen.findByTestId('consent-what')).toBeOnTheScreen();
    expect(screen.queryByTestId('guardian-declaration')).toBeNull();
    expect(server.calls.some((c) => c.path === '/rest/v1/rpc/declare_guardian')).toBe(true);
  });
});
