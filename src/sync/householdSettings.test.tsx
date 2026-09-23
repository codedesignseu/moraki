import { cleanup, fireEvent, screen, waitFor, within } from 'expo-router/testing-library';

import { META_KEYS } from '@/db/meta';
import { meta } from '@/db/schema';
import { CONSENT_VERSION } from '@/features/privacy/useConsent';
import { createAuth } from '@/sync/auth';
import { createHarness, renderApp, type Harness } from '@/testing/appHarness';
import { createFakeNotifications } from '@/testing/fakeNotifications';
import {
  EMAIL,
  TEST_SUPABASE_ENV,
  USER_ID,
  authServer,
  keychain,
} from '@/testing/fakeSupabaseAuth';

jest.mock('@/ui/deviceTimeZone', () => ({ deviceTimeZone: () => 'Europe/Nicosia' }));

const MIN = 60_000;
const HOUR = 60 * MIN;
const NOW = Date.parse('2026-10-28T12:00:00Z');
const HOUSEHOLD = '0190a0b0-0000-7000-8000-0000000000a1';
const BABY = '0190a0b0-0000-7000-8000-0000000000b1';

let h: Harness;
beforeEach(async () => {
  h = await createHarness(NOW);
});
afterEach(async () => {
  // Each test renders the app once; without this the next render finds the
  // previous one still mounted.
  await cleanup();
  jest.clearAllTimers();
  jest.useRealTimers();
});

/** This phone belongs to the household and may send. */
function link() {
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
  h.prefs.set('consent', { userId: USER_ID, version: CONSENT_VERSION, grantedAt: NOW });
  h.prefs.set('reminders', true);
}

/** The account's record of its household, as P2-05 or P2-06 wrote it. */
const record = (role: 'owner' | 'caregiver') =>
  h.prefs.set('accountHousehold', {
    userId: USER_ID,
    householdId: HOUSEHOLD,
    babyId: BABY,
    babyName: 'Ella',
    role,
    bornAt: Date.parse('2026-10-09T06:20:00Z'),
    birthWeightG: 3400,
  });

/**
 * Signs in and renders the app against a fake server. The same keychain is
 * used for both, as one phone has one.
 */
async function openApp(
  options: Parameters<typeof authServer>[0] = {},
  extras: Parameters<typeof renderApp>[1] = {},
) {
  const server = authServer({ events: () => [], caregivers: [], ...options });
  const { store } = keychain();
  const signingIn = createAuth(TEST_SUPABASE_ENV, store, server.fetchImpl);
  await signingIn.verifyCode(EMAIL, '123456');
  signingIn.setForeground(false);
  await renderApp(h.repo, {
    auth: createAuth(TEST_SUPABASE_ENV, store, server.fetchImpl),
    ...extras,
  });
  return server;
}

const card = async () => within(await screen.findByTestId('settings-reminders'));
const openSettings = async () =>
  fireEvent.press(await screen.findByRole('button', { name: /Settings/ }));

describe('the household’s feed interval reaching the other phone', () => {
  it('takes the household’s number, not the one this phone happened to have', async () => {
    // This phone was set to four hours before it joined; the household says three.
    link();
    record('caregiver');
    h.prefs.set('reminderIntervalMin', 240);
    h.repo.insert({
      type: 'feed_bottle',
      occurredAt: NOW - HOUR,
      payload: { ml: 90, milk: 'formula' },
    });
    const os = createFakeNotifications();
    await openApp(
      { household: { name: 'Ella', reminder_interval_min: 180, second_reminder_min: null } },
      { notifications: os },
    );

    // The pull brings the household's row, and the reminder moves to match it.
    await waitFor(() => expect(h.prefs.get('reminderIntervalMin')).toBe(180));
    await waitFor(() => expect(os.held()[0]?.at).toBe(NOW - HOUR + 3 * HOUR));
  });

  it('takes the second reminder the household set, too', async () => {
    link();
    record('caregiver');
    h.repo.insert({
      type: 'feed_bottle',
      occurredAt: NOW - HOUR,
      payload: { ml: 90, milk: 'formula' },
    });
    const os = createFakeNotifications();
    await openApp(
      { household: { name: 'Ella', reminder_interval_min: 180, second_reminder_min: 30 } },
      { notifications: os },
    );

    await waitFor(() => expect(os.held()).toHaveLength(2));
    expect(os.held()[1]?.at).toBe(NOW - HOUR + 3 * HOUR + 30 * MIN);
  });

  it('shows a caregiver the household’s numbers without letting them drift', async () => {
    link();
    record('caregiver');
    await openApp({
      household: { name: 'Ella', reminder_interval_min: 210, second_reminder_min: null },
    });
    await openSettings();

    await waitFor(async () => expect((await card()).getByText('210 min')).toBeOnTheScreen());
    // No stepper to nudge: a change here would be overwritten by the next
    // pull, and meanwhile the two phones would disagree.
    expect((await card()).queryByLabelText('Remind me this long after a feed')).toBeNull();
    expect(
      (await card()).getByText('The household owner sets these. Your reminders follow them.'),
    ).toBeOnTheScreen();
  });

  it('lets the owner change it, and writes it where the household keeps it', async () => {
    link();
    record('owner');
    const written: Record<string, unknown>[] = [];
    await openApp({
      household: { name: 'Ella', reminder_interval_min: 180, second_reminder_min: null },
      updateHousehold: (columns) => written.push(columns),
    });
    await openSettings();
    // Wait for the pull to have brought the household's own number, so the
    // change is made on top of it rather than racing it.
    await waitFor(() => expect(h.prefs.get('reminderIntervalMin')).toBe(180));
    await fireEvent(
      (await card()).getByLabelText('Remind me this long after a feed'),
      'accessibilityAction',
      { nativeEvent: { actionName: 'increment' } },
    );

    await waitFor(() => expect(written).toContainEqual({ reminder_interval_min: 195 }));
    expect(
      (await card()).getByText('This is the household’s setting, so it changes for everyone.'),
    ).toBeOnTheScreen();
  });

  it('brings the baby’s details back too, so a rename reaches this phone', async () => {
    link();
    record('caregiver');
    await openApp({
      household: { name: 'Ella', reminder_interval_min: 180, second_reminder_min: null },
      babies: [
        // Another household's baby, which this phone must not take.
        {
          id: '0190a0b0-0000-7000-8000-0000000000c9',
          name: 'Not ours',
          household_id: '0190a0b0-0000-7000-8000-0000000000f9',
          born_at: '2026-01-01T00:00:00Z',
          birth_weight_g: 2000,
        },
        {
          id: BABY,
          name: 'Eleni',
          household_id: HOUSEHOLD,
          born_at: '2026-10-09T06:20:00Z',
          birth_weight_g: 3450,
        },
      ],
    });

    // The corrected name and birth weight, which no pull of events carries.
    await waitFor(() => expect(h.prefs.get('accountHousehold')?.babyName).toBe('Eleni'));
    expect(h.prefs.get('accountHousehold')?.birthWeightG).toBe(3450);
  });
});
