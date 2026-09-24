import { fireEvent, screen, waitFor, within } from 'expo-router/testing-library';

import { CONSENT_VERSION } from '@/features/privacy/useConsent';
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
/** Born 20 days before "now", at midday local. */
const BORN = Date.parse('2026-10-08T10:00:00Z');

let h: Harness;
beforeEach(async () => {
  h = await createHarness(NOW);
});
afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
});

function knowsTheBaby(role: 'owner' | 'caregiver' = 'owner') {
  h.prefs.set('accountHousehold', {
    userId: USER_ID,
    householdId: HOUSEHOLD,
    babyId: BABY,
    babyName: 'Ella',
    role,
    bornAt: BORN,
    birthWeightG: 3400,
  });
  h.prefs.set('consent', { userId: USER_ID, version: CONSENT_VERSION, grantedAt: NOW });
}

async function openBaby(options: Parameters<typeof authServer>[0] = {}) {
  const server = authServer({ events: () => [], caregivers: [], ...options });
  const { store } = keychain();
  const signingIn = createAuth(TEST_SUPABASE_ENV, store, server.fetchImpl);
  await signingIn.verifyCode(EMAIL, '123456');
  signingIn.setForeground(false);
  await renderApp(h.repo, { auth: createAuth(TEST_SUPABASE_ENV, store, server.fetchImpl) });
  await fireEvent.press(await screen.findByRole('button', { name: /Settings/ }));
  await fireEvent.press(await screen.findByRole('button', { name: 'Baby details' }));
  await screen.findByTestId('baby-details');
  return server;
}

const nudge = async (label: string, action: 'increment' | 'decrement', times = 1) => {
  for (let i = 0; i < times; i += 1) {
    await fireEvent(await screen.findByLabelText(label), 'accessibilityAction', {
      nativeEvent: { actionName: action },
    });
  }
};

describe('correcting the baby’s details', () => {
  it('opens on what was recorded', async () => {
    knowsTheBaby();
    await openBaby();

    expect(screen.getByDisplayValue('Ella')).toBeOnTheScreen();
    expect(screen.getByTestId('baby-born-on')).toHaveTextContent(/Thu 8 Oct/);
    expect(screen.getByLabelText('Birth weight in grams')).toBeOnTheScreen();
  });

  it('sends a corrected name, birth date and weight to the household’s record', async () => {
    knowsTheBaby();
    const sent: Record<string, unknown>[] = [];
    await openBaby({ updateBaby: (columns) => sent.push(columns) });

    await fireEvent.changeText(screen.getByLabelText('Name'), 'Eleni');
    // Born a day earlier than first typed.
    await nudge('Born this many days ago', 'increment');
    await nudge('Birth weight in grams', 'increment', 5); // 3400 → 3450
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(sent).toHaveLength(1));
    expect(sent[0]).toMatchObject({
      name: 'Eleni',
      // Midday local on 7 October — which is 09:00 UTC, not 10:00: Nicosia
      // was still on UTC+3 before the clocks changed on 25 October. A birth
      // date is a date, so it keeps its time of day across the change.
      born_at: '2026-10-07T09:00:00.000Z',
      birth_weight_g: 3450,
    });
  });

  it('updates this phone at once, so the weight chart follows', async () => {
    knowsTheBaby();
    await openBaby({ updateBaby: () => {} });

    await fireEvent.changeText(screen.getByLabelText('Name'), 'Eleni');
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(h.prefs.get('accountHousehold')?.babyName).toBe('Eleni'));
    expect(await screen.findByTestId('baby-saved')).toBeOnTheScreen();
  });

  it('records that nobody knows the birth weight, rather than guessing one', async () => {
    knowsTheBaby();
    const sent: Record<string, unknown>[] = [];
    await openBaby({ updateBaby: (columns) => sent.push(columns) });

    await fireEvent.press(
      within(screen.getByTestId('baby-details')).getByRole('radio', { name: "I don't know it" }),
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(sent).toHaveLength(1));
    expect(sent[0]).toMatchObject({ birth_weight_g: null });
    expect(h.prefs.get('accountHousehold')?.birthWeightG).toBe(null);
  });

  it('will not save a baby with no name', async () => {
    knowsTheBaby();
    await openBaby();

    await fireEvent.changeText(screen.getByLabelText('Name'), '   ');
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  it('says so when the phone is offline, and changes nothing here', async () => {
    knowsTheBaby();
    await openBaby({
      updateBaby: () => {
        throw new TypeError('Network request failed');
      },
    });

    await fireEvent.changeText(screen.getByLabelText('Name'), 'Eleni');
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByTestId('baby-problem')).toHaveTextContent(
      'No connection. Try again when you have one.',
    );
    // The household's record is the truth; this phone doesn't pretend.
    expect(h.prefs.get('accountHousehold')?.babyName).toBe('Ella');
  });

  it('is offered to a caregiver too, not just the owner', async () => {
    // A typo is noticed by whoever is holding the baby (SDD 4.3 babies_update
    // asks for can_write, not ownership).
    knowsTheBaby('caregiver');
    await openBaby();
    expect(screen.getByDisplayValue('Ella')).toBeOnTheScreen();
  });
});
