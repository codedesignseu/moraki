import { fireEvent, screen, within } from 'expo-router/testing-library';

import i18n from '@/i18n';
import { createHarness, renderApp, type Harness } from '@/testing/appHarness';

jest.mock('@/ui/deviceTimeZone', () => ({ deviceTimeZone: () => 'Europe/Nicosia' }));

// The phone's own language, which `device` follows. English here, so choosing
// Greek is a real override rather than the same answer twice.
const ENGLISH_PHONE = [{ languageCode: 'en', languageTag: 'en-GB' }];
let mockDeviceLocales = ENGLISH_PHONE;
jest.mock('expo-localization', () => ({
  // jest hoists this above the assignment above, and `@/i18n` reads the
  // language as it loads, so the fallback is what answers that first call.
  getLocales: () => mockDeviceLocales ?? [{ languageCode: 'en', languageTag: 'en-GB' }],
  getCalendars: () => [{ timeZone: 'Europe/Nicosia' }],
}));

const NOW = Date.parse('2026-10-23T09:00:00Z');

let h: Harness;
afterEach(async () => {
  mockDeviceLocales = ENGLISH_PHONE;
  await i18n.changeLanguage('en');
  jest.useRealTimers();
});

async function openSettings(): Promise<void> {
  await renderApp(h.repo);
  await fireEvent.press(screen.getByRole('button', { name: /Settings|Ρυθμίσεις/ }));
  await screen.findByTestId('settings-language');
}

describe('the language switch', () => {
  it('follows the phone until someone chooses, and says which language that is', async () => {
    h = await createHarness(NOW);
    await openSettings();

    const card = within(screen.getByTestId('settings-language'));
    expect(card.getByText(/follows your phone's language: English/)).toBeOnTheScreen();
    // Nothing chosen, so the screen itself is still in English.
    expect(screen.getByText('Language')).toBeOnTheScreen();
  });

  it('starts in Greek on a Greek phone, with nothing chosen', async () => {
    mockDeviceLocales = [{ languageCode: 'el', languageTag: 'el-CY' }];
    await i18n.changeLanguage('el');
    h = await createHarness(NOW);
    await openSettings();

    expect(screen.getByTestId('settings-night-mode')).toBeOnTheScreen();
    expect(
      within(screen.getByTestId('settings-night-mode')).getByText('Νυχτερινή λειτουργία'),
    ).toBeOnTheScreen();
  });

  it('switches the whole app to Greek, dates included', async () => {
    h = await createHarness(NOW);
    // Three days back, so its heading is a formatted date rather than "Today".
    h.repo.insert({
      type: 'feed_bottle',
      occurredAt: NOW - 3 * 24 * 3600_000,
      payload: { ml: 90, milk: 'formula' },
    });
    await openSettings();
    await fireEvent.press(screen.getByRole('radio', { name: 'Ελληνικά' }));

    // The screen it was pressed on is already Greek.
    expect(await screen.findByText('Γλώσσα')).toBeOnTheScreen();
    expect(screen.getByText('Νυχτερινή λειτουργία')).toBeOnTheScreen();
    // History's day headings are Intl dates: Greek words, and day before month.
    await fireEvent.press(screen.getByRole('button', { name: /Ιστορικό/ }));
    expect(await screen.findByText(/20 Οκτωβρίου/)).toBeOnTheScreen();
  });

  it('keeps the choice on this phone, so the next launch opens in Greek', async () => {
    h = await createHarness(NOW);
    await openSettings();
    await fireEvent.press(screen.getByRole('radio', { name: 'Ελληνικά' }));
    await screen.findByText('Γλώσσα');

    // A new launch: the same database, a fresh render, and i18next back where
    // it starts. The stored choice is what puts it in Greek again.
    await i18n.changeLanguage('en');
    await openSettings();
    expect(screen.getByText('Γλώσσα')).toBeOnTheScreen();
    expect(
      within(screen.getByTestId('settings-language')).getByText(/Μόνο σε αυτό το τηλέφωνο/),
    ).toBeOnTheScreen();
  });

  it('goes back to English, and back to following the phone', async () => {
    h = await createHarness(NOW);
    await openSettings();
    await fireEvent.press(screen.getByRole('radio', { name: 'Ελληνικά' }));
    await screen.findByText('Γλώσσα');
    await fireEvent.press(screen.getByRole('radio', { name: 'English' }));
    expect(await screen.findByText('Language')).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('radio', { name: "Your phone's" }));
    expect(
      within(screen.getByTestId('settings-language')).getByText(
        /follows your phone's language: English/,
      ),
    ).toBeOnTheScreen();
  });
});
