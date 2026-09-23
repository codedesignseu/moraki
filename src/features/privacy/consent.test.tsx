import { fireEvent, screen, waitFor, within } from 'expo-router/testing-library';

import { META_KEYS } from '@/db/meta';
import { meta } from '@/db/schema';
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

let h: Harness;
beforeEach(async () => {
  h = await createHarness(NOW);
});
afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
});

/** This phone belongs to the household, so only consent is in question. */
function link(babyId: string) {
  for (const [key, value] of [
    [META_KEYS.householdId, HOUSEHOLD],
    [META_KEYS.userId, USER_ID],
    [META_KEYS.localBabyId, babyId],
  ] as const) {
    h.mem.db
      .insert(meta)
      .values({ key, value })
      .onConflictDoUpdate({ target: meta.key, set: { value } })
      .run();
  }
}

async function signedIn(options: Parameters<typeof authServer>[0] = {}) {
  const server = authServer({ events: () => [], ...options });
  const { store } = keychain();
  const signingIn = createAuth(TEST_SUPABASE_ENV, store, server.fetchImpl);
  await signingIn.verifyCode(EMAIL, '123456');
  signingIn.setForeground(false);
  await renderApp(h.repo, { auth: createAuth(TEST_SUPABASE_ENV, store, server.fetchImpl) });
  return server;
}

const openSettings = () => fireEvent.press(screen.getByRole('button', { name: /Settings/ }));
const openConsent = async () => {
  await openSettings();
  await fireEvent.press(await screen.findByRole('button', { name: 'Health data' }));
  await screen.findByTestId('consent-what');
};

describe('asking for consent', () => {
  it('asks on its own screen, saying what is processed, where and by whom', async () => {
    await signedIn();
    await openConsent();

    const card = within(screen.getByTestId('consent-what'));
    expect(
      card.getByText(/That is health data, so we ask before processing it\./),
    ).toBeOnTheScreen();
    expect(card.getByText(/servers in the EU/)).toBeOnTheScreen();
    expect(card.getByText(/never sold, never used for advertising/)).toBeOnTheScreen();
    expect(card.getByText(/export everything or delete it at any time/)).toBeOnTheScreen();
    expect(card.getByText('Policy version 2026-09-23')).toBeOnTheScreen();
    // Nothing is agreed by opening the screen.
    expect(screen.getByRole('button', { name: 'I agree' })).toBeOnTheScreen();
    expect(screen.queryByTestId('consent-granted')).toBeNull();
  });

  it('records the agreement with the server and remembers it on this phone', async () => {
    const calls: string[] = [];
    await signedIn({
      consent: (path) => (calls.push(path), new Response('null', { status: 200 })),
    });
    await openConsent();

    await fireEvent.press(screen.getByRole('button', { name: 'I agree' }));

    await waitFor(() => expect(calls).toEqual(['/rest/v1/rpc/grant_consent']));
    expect(h.prefs.get('consent')).toMatchObject({ userId: USER_ID, version: '2026-09-23' });
  });

  it('lets it be withdrawn again, keeping what is already logged', async () => {
    const calls: string[] = [];
    await signedIn({
      consent: (path) => (calls.push(path), new Response('null', { status: 200 })),
    });
    const logged = h.repo.insert({ type: 'diaper', occurredAt: NOW, payload: { kind: 'wet' } });
    await openConsent();
    await fireEvent.press(screen.getByRole('button', { name: 'I agree' }));
    // Agreeing closes the screen, so it is opened again to change the answer.
    await waitFor(() => expect(h.prefs.get('consent')).not.toBe(null));
    await openConsent();

    await fireEvent.press(await screen.findByRole('button', { name: 'Withdraw my agreement' }));

    await waitFor(() => expect(calls).toContain('/rest/v1/rpc/withdraw_consent'));
    expect(h.prefs.get('consent')).toBe(null);
    // Nothing was deleted: the entry is still on this phone.
    expect(h.repo.get(logged.id)?.deletedAt).toBe(null);
  });

  it('says so when the phone is offline, and agrees to nothing', async () => {
    await signedIn({
      consent: () => {
        throw new TypeError('Network request failed');
      },
    });
    await openConsent();

    await fireEvent.press(screen.getByRole('button', { name: 'I agree' }));

    // The screen stays open with the reason on it: a failure that closed the
    // screen would look like it worked.
    expect(await screen.findByTestId('consent-problem')).toHaveTextContent(
      'No connection. Try again when you have one.',
    );
    expect(screen.getByRole('button', { name: 'I agree' })).toBeOnTheScreen();
    expect(h.prefs.get('consent')).toBe(null);
  });
});

describe('what happens until someone agrees', () => {
  it('sends nothing, and says why in Settings', async () => {
    const pushes: unknown[] = [];
    const logged = h.repo.insert({ type: 'diaper', occurredAt: NOW, payload: { kind: 'wet' } });
    link(logged.babyId);
    await signedIn({
      pushEvents: (ops) => (pushes.push(ops), new Response('[]', { status: 200 })),
    });

    await openSettings();
    const card = within(await screen.findByTestId('settings-sync'));
    expect(
      card.getByText('Sharing is off until you agree to health data being processed.'),
    ).toBeOnTheScreen();
    // Not one op was sent: the entry waits on the phone.
    expect(pushes).toEqual([]);
    expect(h.outbox.pending()).toBeGreaterThan(0);
  });

  it('starts sending once it is agreed', async () => {
    const pushes: unknown[][] = [];
    const logged = h.repo.insert({ type: 'diaper', occurredAt: NOW, payload: { kind: 'wet' } });
    link(logged.babyId);
    await signedIn({
      consent: () => new Response('null', { status: 200 }),
      pushEvents: (ops) => {
        pushes.push(ops);
        return new Response(
          JSON.stringify(
            ops.map((op) => ({ id: op.body.id, op: op.op, status: 'applied', reason: null })),
          ),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      },
    });

    await openConsent();
    await fireEvent.press(screen.getByRole('button', { name: 'I agree' }));

    await waitFor(() => expect(pushes.length).toBeGreaterThan(0));
  });

  it('shows in Settings whether this account has agreed', async () => {
    await signedIn({ consent: () => new Response('null', { status: 200 }) });
    await openSettings();
    expect(
      within(await screen.findByTestId('settings-privacy')).getByText('Not agreed yet'),
    ).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Health data' }));
    await fireEvent.press(await screen.findByRole('button', { name: 'I agree' }));

    await openSettings();
    await waitFor(() =>
      expect(within(screen.getByTestId('settings-privacy')).getByText('Agreed')).toBeOnTheScreen(),
    );
  });
});
