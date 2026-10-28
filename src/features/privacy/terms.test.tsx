import { fireEvent, screen, waitFor, within } from 'expo-router/testing-library';

import { META_KEYS } from '@/db/meta';
import { meta } from '@/db/schema';
import { CONSENT_VERSION, TERMS_VERSION } from '@/domain/consent/consent';
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
const AGREE = 'I agree to the Terms of Use';

let h: Harness;
beforeEach(async () => {
  h = await createHarness(NOW);
});
afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
});

const press = (name: string | RegExp) => fireEvent.press(screen.getByRole('button', { name }));

/** Signed in already, agreed to health data, linked to a household as a caregiver. */
async function signedIn(options: Parameters<typeof authServer>[0] = {}) {
  const server = authServer({
    events: () => [],
    babies: [{ id: BABY, name: 'Ella', household_id: HOUSEHOLD }],
    memberships: [{ household_id: HOUSEHOLD, role: 'caregiver' }],
    ...options,
  });
  const { store } = keychain();
  const signingIn = createAuth(TEST_SUPABASE_ENV, store, server.fetchImpl);
  await signingIn.verifyCode(EMAIL, '123456');
  signingIn.setForeground(false);
  h.prefs.set('consent', { userId: USER_ID, version: CONSENT_VERSION, grantedAt: NOW });
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

describe('agreeing to the Terms when signing in (P0.9)', () => {
  it('links both documents and goes no further until the box is ticked', async () => {
    const server = authServer({ events: () => [] });
    const { store } = keychain();
    await renderApp(h.repo, { auth: createAuth(TEST_SUPABASE_ENV, store, server.fetchImpl) });
    await press(/Settings/);
    await press('Sign in');

    expect(screen.getByRole('button', { name: 'Read the Terms of Use' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Read the Privacy Policy' })).toBeOnTheScreen();
    expect(screen.getByRole('checkbox', { name: AGREE })).not.toBeChecked();
    await fireEvent.changeText(screen.getByLabelText('Email'), EMAIL);
    await press('Send code');

    expect(screen.getByText('Error: Tick the box to agree to the Terms of Use.')).toBeOnTheScreen();
    expect(server.calls.some((c) => c.path === '/auth/v1/otp')).toBe(false);

    await fireEvent.press(screen.getByRole('checkbox', { name: AGREE }));
    await press('Send code');
    await fireEvent.changeText(await screen.findByLabelText('Code'), '123456');
    await press('Sign in');

    // Recorded with its version, its language and the Privacy Policy linked beside it.
    await waitFor(() =>
      expect(server.calls.find((c) => c.path === '/rest/v1/rpc/record_consent')?.body).toEqual({
        purpose: 'terms',
        version: TERMS_VERSION,
        action: 'grant',
        locale: 'en',
        text_key: 'terms;privacy=2026-10-28',
      }),
    );
    await waitFor(() =>
      expect(h.prefs.get('terms')).toEqual({ userId: USER_ID, version: TERMS_VERSION }),
    );
  });
});

describe('when the Terms change (P1.4)', () => {
  it('asks again on the next open, with the disclaimer, and syncs nothing until agreed', async () => {
    const pushes: unknown[] = [];
    h.prefs.set('terms', { userId: USER_ID, version: '2026-01-01' });
    h.repo.insert({ type: 'diaper', occurredAt: NOW - 60_000, payload: { kind: 'wet' } });
    const server = await signedIn({
      termsEvents: () => [],
      pushEvents: (ops) => (pushes.push(ops), new Response('[]', { status: 200 })),
    });

    expect(await screen.findByText('We updated our Terms')).toBeOnTheScreen();
    expect(screen.getByTestId('terms-disclaimer')).toHaveTextContent(
      'Moraki is a notebook, not medical advice. If you’re worried about your baby, contact your doctor.',
    );
    expect(screen.getByRole('checkbox', { name: AGREE })).not.toBeChecked();
    expect(pushes).toEqual([]);

    await press('Continue');
    expect(screen.getByText('Error: Tick the box to agree to the Terms of Use.')).toBeOnTheScreen();
    expect(server.calls.some((c) => c.path === '/rest/v1/rpc/record_consent')).toBe(false);

    await fireEvent.press(screen.getByRole('checkbox', { name: AGREE }));
    await press('Continue');

    await waitFor(() => expect(h.prefs.get('terms')?.version).toBe(TERMS_VERSION));
    await waitFor(() => expect(screen.queryByTestId('terms-agreement')).toBeNull());
    await waitFor(() => expect(pushes).toHaveLength(1));
  });

  it('says why nothing syncs if they close it', async () => {
    h.repo.insert({ type: 'diaper', occurredAt: NOW - 60_000, payload: { kind: 'wet' } });
    await signedIn({ termsEvents: () => [] });
    await screen.findByTestId('terms-agreement');
    await press('Not now');

    await press(/Settings/);
    expect(
      within(await screen.findByTestId('settings-sync')).getByText(
        'Sharing is paused until you agree to the Terms of Use.',
      ),
    ).toBeOnTheScreen();
  });

  it('is not asked when the server has this account agreeing, from another phone', async () => {
    await signedIn({ termsEvents: () => [{ id: 1 }] });

    await waitFor(() => expect(h.prefs.get('terms')?.version).toBe(TERMS_VERSION));
    expect(screen.queryByTestId('terms-agreement')).toBeNull();
  });
});

describe('the Terms from Settings (P0.9)', () => {
  it('opens them with both links and the disclaimer, and records agreeing', async () => {
    const server = await signedIn();
    await press(/Settings/);
    await fireEvent.press(await screen.findByRole('button', { name: 'Terms of Use' }));

    const card = within(await screen.findByTestId('terms-agreement'));
    expect(card.getByRole('button', { name: 'Read the Terms of Use' })).toBeOnTheScreen();
    expect(card.getByRole('button', { name: 'Read the Privacy Policy' })).toBeOnTheScreen();
    expect(screen.getByTestId('terms-disclaimer')).toHaveTextContent(
      'Moraki is a notebook, not medical advice. If you’re worried about your baby, contact your doctor.',
    );
    await press('Continue');
    expect(screen.getByText('Error: Tick the box to agree to the Terms of Use.')).toBeOnTheScreen();
    expect(server.calls.some((c) => c.path === '/rest/v1/rpc/record_consent')).toBe(false);

    await fireEvent.press(screen.getByRole('checkbox', { name: AGREE }));
    await press('Continue');
    await waitFor(() => expect(h.prefs.get('terms')?.version).toBe(TERMS_VERSION));
    await waitFor(() => expect(screen.queryByTestId('terms-agreement')).toBeNull());
  });

  it('are needed before setting up a household', async () => {
    const server = await signedIn({ termsEvents: () => [], memberships: [], babies: [] });
    // Asked on opening (P1.4), and put off.
    await screen.findByTestId('terms-agreement');
    await press('Not now');
    await press(/Settings/);
    await press('Set up household');
    await fireEvent.changeText(screen.getByLabelText('Your name'), 'Maria');
    await fireEvent.changeText(screen.getByLabelText('Name'), 'Ella');
    await fireEvent.press(screen.getByRole('checkbox', { name: /parent or legal guardian/ }));
    await press('Create household');

    expect(
      await screen.findByText('Error: Agree to the Terms of Use first, in Settings → Privacy.'),
    ).toBeOnTheScreen();
    expect(server.calls.some((c) => c.path === '/rest/v1/rpc/create_household')).toBe(false);
  });
});

describe('the health-data consent screen (P0.9)', () => {
  it('links the Privacy Policy and the Terms', async () => {
    h.prefs.set('terms', { userId: USER_ID, version: TERMS_VERSION });
    // A guardian's consent (P0.2): the owner of the household.
    await signedIn({ memberships: [{ household_id: HOUSEHOLD, role: 'owner' }] });
    await press(/Settings/);
    await fireEvent.press(await screen.findByRole('button', { name: 'Review consent' }));

    const links = within(await screen.findByTestId('consent-links'));
    expect(links.getByRole('button', { name: 'Read the Privacy Policy' })).toBeOnTheScreen();
    expect(links.getByRole('button', { name: 'Read the Terms of Use' })).toBeOnTheScreen();
  });
});
