import { fireEvent, screen, within } from 'expo-router/testing-library';
import { Linking } from 'react-native';

import type { EventsRepository } from '@/db/repositories/events';
import { legalLink } from '@/features/privacy/AboutScreen';
import { createHarness, renderApp } from '@/testing/appHarness';

jest.mock('@/ui/deviceTimeZone', () => ({ deviceTimeZone: () => 'Europe/Nicosia' }));

const NOW = Date.parse('2026-10-28T12:00:00Z');
let repo: EventsRepository;

beforeEach(async () => {
  ({ repo } = await createHarness(NOW));
});
afterEach(() => {
  jest.useRealTimers();
});

async function openAbout() {
  await renderApp(repo);
  await fireEvent.press(screen.getByRole('button', { name: /Settings/ }));
  await fireEvent.press(await screen.findByRole('button', { name: 'About Moraki' }));
  return within(await screen.findByTestId('about-disclaimer'));
}

describe('the disclaimer', () => {
  it('is reachable from Settings and says the app is not a medical device', async () => {
    const card = await openAbout();
    expect(card.getByText('Moraki is a notebook, not a medical device')).toBeOnTheScreen();
    expect(card.getByText(/not a substitute for your pediatrician/)).toBeOnTheScreen();
  });

  it('says plainly that it never reads anything into a number', async () => {
    const card = await openAbout();
    expect(card.getByText(/never tells you what a number means/)).toBeOnTheScreen();
    expect(card.getByText(/no warnings, no ranges and no colours/)).toBeOnTheScreen();
  });

  it('points somewhere real when a caregiver is worried now', async () => {
    const card = await openAbout();
    expect(card.getByText(/contact your doctor or your local emergency number/)).toBeOnTheScreen();
  });

  it('is visible in Settings without opening it', async () => {
    await renderApp(repo);
    await fireEvent.press(screen.getByRole('button', { name: /Settings/ }));
    expect(
      within(await screen.findByTestId('settings-about')).getByText(
        'Moraki is a notebook, not a medical device',
      ),
    ).toBeOnTheScreen();
  });

  it('describes what the app does without promising anything about the baby', async () => {
    await openAbout();
    const what = within(screen.getByTestId('about-what'));
    expect(what.getByText(/as you log them/)).toBeOnTheScreen();
    expect(what.getByText(/works with no signal/)).toBeOnTheScreen();
  });

  it('links to the privacy policy, terms and support, as App Store guideline 5.1.1(i) asks', async () => {
    const opened = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    await openAbout();
    const legal = within(screen.getByTestId('about-legal'));
    await fireEvent.press(legal.getByRole('button', { name: 'Privacy policy' }));
    await fireEvent.press(legal.getByRole('button', { name: 'Terms of use' }));
    await fireEvent.press(legal.getByRole('button', { name: 'Help and support' }));
    await fireEvent.press(legal.getByRole('button', { name: 'Email us' }));
    expect(opened.mock.calls.map(([url]) => url)).toEqual([
      'https://moraki.app/privacy/',
      'https://moraki.app/terms/',
      'https://moraki.app/support/',
      'mailto:info@codedesigns.eu',
    ]);
    expect(legal.getByText(/info@codedesigns.eu/)).toBeOnTheScreen();
  });
});

describe('legalLink', () => {
  it('sends a Greek reader to the Greek pages', () => {
    expect(legalLink('privacy', 'el')).toBe('https://moraki.app/el/privacy/');
    expect(legalLink('terms', 'el-GR')).toBe('https://moraki.app/el/terms/');
    expect(legalLink('support', 'en')).toBe('https://moraki.app/support/');
  });
});
