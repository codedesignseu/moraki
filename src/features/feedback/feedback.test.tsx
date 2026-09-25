import { fireEvent, screen, waitFor, within } from 'expo-router/testing-library';

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
// The build details the form sends, from where the app reads them: app.json's
// version through expo-constants, and the phone's language through
// expo-localization. jest-expo leaves the first empty, so it is set here.
jest.mock('expo-constants', () => ({ expoConfig: { version: '0.1.0' } }));
jest.mock('expo-localization', () => ({
  getLocales: () => [{ languageTag: 'en-CY' }],
  getCalendars: () => [{ timeZone: 'Europe/Nicosia' }],
}));

const NOW = Date.parse('2026-10-28T12:00:00Z');

let h: Harness;
beforeEach(async () => {
  h = await createHarness(NOW);
});
afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
});

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
const openFeedback = async () => {
  await openSettings();
  await fireEvent.press(await screen.findByRole('button', { name: 'Send feedback' }));
  await screen.findByTestId('feedback-form');
};
const type = async (text: string) =>
  fireEvent.changeText(await screen.findByLabelText('Your message'), text);
const sendIt = async () => fireEvent.press(screen.getByRole('button', { name: 'Send' }));

describe('sending feedback', () => {
  it('sends the message, what it is about, and the build details — and nothing logged', async () => {
    const sent: Record<string, unknown>[] = [];
    await signedIn({
      feedback: (row) => {
        sent.push(row);
        return undefined;
      },
    });
    await openFeedback();
    await fireEvent.press(screen.getByRole('radio', { name: 'An idea' }));
    await type('  a widget for the last feed  ');
    await sendIt();

    await waitFor(() => expect(sent).toHaveLength(1));
    const row = sent[0]!;
    expect(row.kind).toBe('idea');
    // Trimmed, so trailing spaces aren't part of what someone wrote.
    expect(row.message).toBe('a widget for the last feed');
    expect(row.user_id).toBe(USER_ID);
    expect(row.app_version).toBe('0.1.0');
    expect(row.locale).toBe('en-CY');
    expect(row.platform).toBe('ios');
    // CLAUDE.md rule 8: what travels with it is the build, not the baby.
    expect(Object.keys(row).sort()).toEqual([
      'app_version',
      'kind',
      'locale',
      'message',
      'platform',
      'user_id',
    ]);
  });

  it('says it was sent, and who can read it, rather than closing silently', async () => {
    await signedIn({ feedback: () => undefined });
    await openFeedback();
    await type('the sleep timer stopped');
    await sendIt();

    const done = within(await screen.findByTestId('feedback-sent'));
    expect(done.getByText(/Only you and Moraki's developer can read it\./)).toBeOnTheScreen();
    expect(screen.queryByTestId('feedback-form')).toBeNull();
  });

  it('will not send an empty message, or one that is only spaces', async () => {
    await signedIn({ feedback: () => undefined });
    await openFeedback();
    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled();
    await type('   ');
    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled();
    await type('x');
    expect(screen.getByRole('button', { name: 'Send' })).toBeEnabled();
  });

  it('keeps the message on the screen when the server cannot be reached', async () => {
    await signedIn({
      feedback: () => {
        throw new TypeError('Network request failed');
      },
    });
    await openFeedback();
    await type('the timer stopped');
    await sendIt();

    expect(await screen.findByTestId('feedback-problem')).toHaveTextContent(
      /couldn't reach the server/,
    );
    // Still in the form, still holding what was typed, so nothing is retyped.
    expect(screen.getByLabelText('Your message')).toHaveDisplayValue('the timer stopped');
  });

  it('explains the hourly ceiling rather than reporting a mystery failure', async () => {
    await signedIn({
      feedback: () =>
        new Response(JSON.stringify({ code: '54000', message: 'feedback rate limit' }), {
          status: 500,
          headers: { 'content-type': 'application/json' },
        }),
    });
    await openFeedback();
    await type('again');
    await sendIt();

    expect(await screen.findByTestId('feedback-problem')).toHaveTextContent(
      /a lot of messages in one hour/,
    );
  });

  it('asks a phone with no account to sign in first, rather than offering a form that fails', async () => {
    await renderApp(h.repo);
    await openSettings();

    const card = within(await screen.findByTestId('settings-feedback'));
    expect(card.getByText(/needs an account/)).toBeOnTheScreen();
    expect(card.queryByRole('button', { name: 'Send feedback' })).toBeNull();
  });

  it('asks for the app, not the baby', async () => {
    await signedIn({ feedback: () => undefined });
    await openFeedback();

    const form = within(screen.getByTestId('feedback-form'));
    expect(form.getByText(/leave out health details about your baby/)).toBeOnTheScreen();
    expect(form.getByText(/EU and nowhere else/)).toBeOnTheScreen();
    expect(form.getByText(/Nothing you have logged\./)).toBeOnTheScreen();
  });
});
