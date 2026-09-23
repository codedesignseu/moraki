import { fireEvent, screen, within } from 'expo-router/testing-library';

import type { EventsRepository } from '@/db/repositories/events';
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
});
