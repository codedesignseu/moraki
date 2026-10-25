import { fireEvent, screen, waitFor, within } from 'expo-router/testing-library';

import { META_KEYS } from '@/db/meta';
import { meta } from '@/db/schema';
import { TERMS_VERSION } from '@/domain/consent/consent';
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
const STATEMENT =
  'I’ll use what I see in this household only to help care for the baby, and I won’t share it with anyone outside the household.';

let h: Harness;
beforeEach(async () => {
  h = await createHarness(NOW);
});
afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
});

const press = (name: string | RegExp) => fireEvent.press(screen.getByRole('button', { name }));

/**
 * A caregiver from before the agreement existed (P0.2), signed in, Terms
 * agreed, linked to the household, with one entry waiting to be sent. The
 * server says they haven't accepted until `record_consent` records it.
 */
async function existingCaregiver(options: Parameters<typeof authServer>[0] = {}) {
  let accepted = false;
  const pushes: unknown[] = [];
  const server = authServer({
    babies: [{ id: BABY, name: 'Ella', household_id: HOUSEHOLD }],
    memberships: [{ household_id: HOUSEHOLD, role: 'caregiver' }],
    events: () => [],
    membershipStatus: () => ({
      status: 'member',
      role: 'caregiver',
      is_guardian: false,
      access: accepted ? 'granted' : 'needs_agreement',
      baby_id: BABY,
      baby_name: 'Ella',
    }),
    recordConsent: (body) => {
      if (body.purpose === 'caregiver_agreement') accepted = true;
      return undefined;
    },
    pushEvents: (ops) => {
      pushes.push(ops);
      return new Response(
        JSON.stringify(
          ops.map((op) => ({ id: op.body.id, op: op.op, status: 'applied', reason: null })),
        ),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    },
    ...options,
  });
  const { store } = keychain();
  const signingIn = createAuth(TEST_SUPABASE_ENV, store, server.fetchImpl);
  await signingIn.verifyCode(EMAIL, '123456');
  signingIn.setForeground(false);
  h.prefs.set('terms', { userId: USER_ID, version: TERMS_VERSION });
  h.prefs.set('accountHousehold', {
    userId: USER_ID,
    householdId: HOUSEHOLD,
    babyId: BABY,
    babyName: 'Ella',
    role: options.memberships?.[0]?.role ?? 'caregiver',
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
  const logged = h.repo.insert({ type: 'diaper', occurredAt: NOW, payload: { kind: 'wet' } });
  await renderApp(h.repo, { auth: createAuth(TEST_SUPABASE_ENV, store, server.fetchImpl) });
  return { server, pushes, logged, accepted: () => accepted };
}

describe('the caregiver agreement for a member from before it existed (P0.2)', () => {
  it('is asked once the server says so, and nothing is read or sent until it is accepted', async () => {
    const { server, pushes, logged } = await existingCaregiver();

    const card = within(await screen.findByTestId('caregiver-agreement'));
    expect(
      card.getByText(
        'You’re in Ella’s household as a caregiver: you can log entries and edit them.',
      ),
    ).toBeOnTheScreen();
    expect(card.getByText(/everything logged before you joined/)).toBeOnTheScreen();
    expect(screen.getByRole('checkbox', { name: STATEMENT })).not.toBeChecked();
    expect(screen.getByText('Agreement 2026-10-24')).toBeOnTheScreen();

    expect(server.calls.some((c) => c.path === '/rest/v1/events')).toBe(false);
    expect(pushes).toEqual([]);
    // What the phone has stays: it is still readable here.
    expect(h.repo.get(logged.id)?.deletedAt).toBe(null);
  });

  it('records it for the household, and then sends and reads', async () => {
    const { server, pushes, accepted } = await existingCaregiver();
    await press('Accept');
    expect(screen.getByText('Error: Tick the box to accept the agreement.')).toBeOnTheScreen();
    expect(accepted()).toBe(false);

    await fireEvent.press(screen.getByRole('checkbox', { name: STATEMENT }));
    await press('Accept');

    await waitFor(() => expect(accepted()).toBe(true));
    expect(server.calls.find((c) => c.path === '/rest/v1/rpc/record_consent')?.body).toEqual({
      purpose: 'caregiver_agreement',
      version: '2026-10-24',
      action: 'grant',
      household_id: HOUSEHOLD,
      locale: 'en',
      text_key: 'caregiverAgreement',
    });
    await waitFor(() => expect(pushes.length).toBeGreaterThan(0));
    await waitFor(() => expect(server.calls.some((c) => c.path === '/rest/v1/events')).toBe(true));
  });

  it('says in Settings why nothing is shared, and what is agreed', async () => {
    await existingCaregiver();
    await screen.findByTestId('caregiver-agreement');
    await press('Not now');
    await press(/Settings/);

    expect(
      within(screen.getByTestId('settings-sync')).getByText(
        'Sharing is paused until you accept the caregiver agreement.',
      ),
    ).toBeOnTheScreen();
    const privacy = within(screen.getByTestId('settings-privacy'));
    expect(privacy.getByLabelText('Caregiver agreement: Not accepted')).toBeOnTheScreen();
    // Consent is the guardian's: a caregiver isn't offered it.
    expect(privacy.queryByRole('button', { name: 'Review consent' })).toBeNull();

    await press('Read the agreement');
    await fireEvent.press(await screen.findByRole('checkbox', { name: STATEMENT }));
    await press('Accept');
    await waitFor(() =>
      expect(
        within(screen.getByTestId('settings-privacy')).getByLabelText(
          'Caregiver agreement: Accepted',
        ),
      ).toBeOnTheScreen(),
    );
  });

  it('stays on the screen with the reason when it doesn’t reach the server', async () => {
    const { accepted } = await existingCaregiver({
      recordConsent: () =>
        new Response(JSON.stringify({ message: 'TypeError: Network request failed' }), {
          status: 500,
          headers: { 'content-type': 'application/json' },
        }),
    });
    await fireEvent.press(await screen.findByRole('checkbox', { name: STATEMENT }));
    await press('Accept');

    expect(await screen.findByText(/^Error: /)).toBeOnTheScreen();
    expect(screen.getByTestId('caregiver-agreement')).toBeOnTheScreen();
    expect(accepted()).toBe(false);
  });
});

describe('withdrawing the agreement (P0.3)', () => {
  it('is leaving the household, confirmed on the leave screen', async () => {
    await existingCaregiver({
      membershipStatus: () => ({
        status: 'member',
        role: 'caregiver',
        is_guardian: false,
        access: 'granted',
        baby_id: BABY,
        baby_name: 'Ella',
      }),
    });
    await press(/Settings/);
    await press('Read the agreement');
    expect(
      await screen.findByText('You accepted this agreement for this household.'),
    ).toBeOnTheScreen();
    expect(screen.queryByRole('checkbox', { name: STATEMENT })).toBeNull();

    await press('Withdraw and leave the household');
    expect(await screen.findByText('Leave this household')).toBeOnTheScreen();
  });
});

describe('a frozen household (P0.3)', () => {
  const frozen = (role: 'owner' | 'caregiver') => ({
    memberships: [{ household_id: HOUSEHOLD, role }],
    membershipStatus: () => ({
      status: 'member',
      role,
      is_guardian: role === 'owner',
      access: 'frozen',
      baby_id: BABY,
      baby_name: 'Ella',
    }),
  });

  it('tells a caregiver it is paused, sends nothing but their own deletions, and offers a way on', async () => {
    const { pushes, server } = await existingCaregiver(frozen('caregiver'));
    const card = within(await screen.findByTestId('household-paused'));
    expect(card.getByText(/so it’s paused: nothing new is shared or shown here/)).toBeOnTheScreen();
    expect(card.getByText('You can still see and delete your own entries.')).toBeOnTheScreen();
    expect(
      screen.getByRole('button', { name: 'I’m the baby’s parent or guardian' }),
    ).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Leave the household' })).toBeOnTheScreen();
    expect(pushes).toEqual([]);
    expect(server.calls.some((c) => c.path === '/rest/v1/events')).toBe(false);

    await press('Close');
    await press(/Settings/);
    expect(
      within(screen.getByTestId('settings-sync')).getByText(
        'Sharing is paused: no parent or guardian in this household agrees to health data being processed right now.',
      ),
    ).toBeOnTheScreen();
  });

  it('offers the guardian who withdrew to agree again, or to delete it', async () => {
    await existingCaregiver(frozen('owner'));
    const card = within(await screen.findByTestId('household-paused'));
    expect(card.getByText(/the household is paused for everyone/)).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Delete the household' })).toBeOnTheScreen();

    await press('Agree to health data');
    expect(await screen.findByTestId('consent-what')).toBeOnTheScreen();
  });
});
