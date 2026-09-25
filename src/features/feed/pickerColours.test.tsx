import { cleanup, fireEvent, screen } from 'expo-router/testing-library';

import type { DevicePrefsRepository } from '@/db/repositories/devicePrefs';
import type { EventsRepository } from '@/db/repositories/events';
import { createHarness, renderApp } from '@/testing/appHarness';
import { colors } from '@/ui/tokens';

jest.mock('@/ui/deviceTimeZone', () => ({ deviceTimeZone: () => 'Europe/Nicosia' }));

const NOW = Date.parse('2026-10-28T12:00:00Z');

let repo: EventsRepository;
let prefs: DevicePrefsRepository;

beforeEach(async () => {
  ({ repo, prefs } = await createHarness(NOW));
});
afterEach(async () => {
  await cleanup();
  jest.useRealTimers();
});

/** Opens the feed sheet and asks for the picker, which is closed until asked for. */
async function openPicker(nightMode: 'on' | 'off') {
  prefs.set('nightMode', nightMode);
  await renderApp(repo);
  await fireEvent.press(await screen.findByRole('button', { name: 'Log feed' }));
  await fireEvent.press(await screen.findByRole('button', { name: 'Feed time' }));
  return screen.getByTestId('feed-when-picker');
}

describe('the colours the picker draws itself with', () => {
  // iOS picks its own, and on the light palette they came out near-white on
  // cream: readable at night, invisible by day. Both are now stated.
  it('is told the light palette on the light theme', async () => {
    const picker = await openPicker('off');

    expect(picker.props.themeVariant).toBe('light');
    expect(picker.props.textColor).toBe(colors.light.text);
  });

  it('is told the dark one at night', async () => {
    const picker = await openPicker('on');

    expect(picker.props.themeVariant).toBe('dark');
    expect(picker.props.textColor).toBe(colors.night.text);
  });

  it('draws nothing at all until it is asked for', async () => {
    await renderApp(repo);
    await fireEvent.press(await screen.findByRole('button', { name: 'Log feed' }));

    await screen.findByTestId('feed-when');
    expect(screen.queryByTestId('feed-when-picker')).toBeNull();
  });
});
