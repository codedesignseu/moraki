import { fireEvent, screen, waitFor, within } from 'expo-router/testing-library';

import { META_KEYS } from '@/db/meta';
import { meta } from '@/db/schema';
import {
  CONSENT_GRACE_MS,
  CONSENT_VERSION,
  CONSENT_VERSIONS,
  consentGraceEndsAt,
} from '@/domain/consent/consent';
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

// 20261026090000: a new consent version, and an agreement to the one before.
const CURRENT = CONSENT_VERSIONS[CONSENT_VERSIONS.length - 1]!;
const PREVIOUS = CONSENT_VERSIONS[CONSENT_VERSIONS.length - 2]!.version;
const HOUSEHOLD = '0190a0b0-0000-7000-8000-0000000000a1';

let h: Harness;
afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
});

/** A guardian owner on this phone, who agreed to the previous text. */
async function guardianOnPrevious(now: number) {
  h = await createHarness(now);
  const logged = h.repo.insert({ type: 'diaper', occurredAt: now, payload: { kind: 'wet' } });
  for (const [key, value] of [
    [META_KEYS.householdId, HOUSEHOLD],
    [META_KEYS.userId, USER_ID],
    [META_KEYS.localBabyId, logged.babyId],
  ] as const) {
    h.mem.db
      .insert(meta)
      .values({ key, value })
      .onConflictDoUpdate({ target: meta.key, set: { value } })
      .run();
  }
  h.prefs.set('accountHousehold', {
    userId: USER_ID,
    householdId: HOUSEHOLD,
    babyId: logged.babyId,
    babyName: 'Ella',
    role: 'owner',
  });
  h.prefs.set('consent', { userId: USER_ID, version: PREVIOUS, grantedAt: now - 86_400_000 });
  return logged;
}

async function open(options: Parameters<typeof authServer>[0] = {}) {
  const server = authServer({ events: () => [], ...options });
  const { store } = keychain();
  const signingIn = createAuth(TEST_SUPABASE_ENV, store, server.fetchImpl);
  await signingIn.verifyCode(EMAIL, '123456');
  signingIn.setForeground(false);
  await renderApp(h.repo, { auth: createAuth(TEST_SUPABASE_ENV, store, server.fetchImpl) });
  return server;
}

describe('a new consent text, in the grace', () => {
  const inGrace = CURRENT.effectiveAt + 3 * 86_400_000;

  it('is offered once at the next open, and "Not now" is an answer', async () => {
    await guardianOnPrevious(inGrace);
    await open();

    expect(await screen.findByTestId('consent-updated')).toHaveTextContent(
      /Your earlier agreement keeps working for 90 days/,
    );
    expect(screen.getByRole('button', { name: 'I agree' })).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Not now' }));
    await waitFor(() => expect(screen.queryByTestId('consent-what')).toBeNull());
    expect(h.prefs.get('consentPromptSeen')).toBe(CONSENT_VERSION);
    // The earlier agreement still stands on this phone.
    expect(h.prefs.get('consent')).toMatchObject({ version: PREVIOUS });
  });

  it('is not offered again at the next open, and still counts as agreed', async () => {
    await guardianOnPrevious(inGrace);
    h.prefs.set('consentPromptSeen', CONSENT_VERSION);
    await open();

    await fireEvent.press(await screen.findByRole('button', { name: /Settings/ }));
    expect(
      within(await screen.findByTestId('settings-privacy')).getByText('Agreed'),
    ).toBeOnTheScreen();
    expect(screen.queryByTestId('consent-updated')).toBeNull();
  });

  it('keeps sharing meanwhile', async () => {
    await guardianOnPrevious(inGrace);
    h.prefs.set('consentPromptSeen', CONSENT_VERSION);
    const pushes: unknown[][] = [];
    await open({
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

    await waitFor(() => expect(pushes.length).toBeGreaterThan(0));
  });

  it('is offered again for the next version', async () => {
    await guardianOnPrevious(inGrace);
    h.prefs.set('consentPromptSeen', PREVIOUS);
    await open();

    expect(await screen.findByTestId('consent-updated')).toBeOnTheScreen();
  });
});

describe('after the grace', () => {
  it('no longer counts: nothing is sent, and the update prompt is not what asks', async () => {
    expect(consentGraceEndsAt()).toBe(CURRENT.effectiveAt + CONSENT_GRACE_MS);
    await guardianOnPrevious(CURRENT.effectiveAt + CONSENT_GRACE_MS + 86_400_000);
    const pushes: unknown[] = [];
    await open({ pushEvents: (ops) => (pushes.push(ops), new Response('[]', { status: 200 })) });

    await fireEvent.press(await screen.findByRole('button', { name: /Settings/ }));
    expect(
      within(await screen.findByTestId('settings-privacy')).getByText('Not agreed'),
    ).toBeOnTheScreen();
    expect(screen.queryByTestId('consent-updated')).toBeNull();
    expect(pushes).toEqual([]);
    expect(h.outbox.pending()).toBeGreaterThan(0);
  });
});
