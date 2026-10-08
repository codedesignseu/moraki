import { act, fireEvent, screen } from 'expo-router/testing-library';

import { createHarness, renderApp, type Harness } from '@/testing/appHarness';

import { RESULT_MS, VERSION_TAPS } from './useSentryTest';

jest.mock('@/ui/deviceTimeZone', () => ({ deviceTimeZone: () => 'Europe/Nicosia' }));
// `mock`-prefixed, because jest hoists the factory above these declarations.
const mockSend = jest.fn();
jest.mock('@/observability/testError', () => ({ sendTestError: () => mockSend() }));

const NOW = Date.parse('2026-10-28T12:00:00Z');

let h: Harness;
beforeEach(async () => {
  h = await createHarness(NOW);
  mockSend.mockReset().mockResolvedValue('sent');
});
afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
});

async function openSettings() {
  await renderApp(h.repo);
  await fireEvent.press(screen.getByRole('button', { name: /Settings/ }));
  return screen.findByTestId('settings-version');
}

const tap = async (times: number) => {
  for (let i = 0; i < times; i++) await fireEvent.press(screen.getByTestId('settings-version'));
};

describe('the hidden Sentry test action', () => {
  it('opens after seven taps on the version, and sends only once confirmed', async () => {
    await openSettings();
    await tap(VERSION_TAPS - 1);
    expect(screen.queryByTestId('settings-sentry-test')).toBeNull();

    await tap(1);
    expect(screen.getByTestId('settings-sentry-test')).toBeOnTheScreen();
    expect(mockSend).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByRole('button', { name: 'Send test error to Sentry' }));
    expect(mockSend).toHaveBeenCalledTimes(1);
    expect(await screen.findByText('Test error sent to Sentry.')).toBeOnTheScreen();
    expect(screen.queryByTestId('settings-sentry-test')).toBeNull();

    await act(async () => {
      jest.advanceTimersByTime(RESULT_MS);
    });
    expect(screen.queryByText('Test error sent to Sentry.')).toBeNull();
  });

  it('sends nothing when cancelled', async () => {
    await openSettings();
    await tap(VERSION_TAPS);
    await fireEvent.press(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByTestId('settings-sentry-test')).toBeNull();
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('says so when the build has crash reporting off', async () => {
    mockSend.mockResolvedValue('off');
    await openSettings();
    await tap(VERSION_TAPS);
    await fireEvent.press(screen.getByRole('button', { name: 'Send test error to Sentry' }));

    expect(
      await screen.findByText('Crash reporting is off in this build, so nothing was sent.'),
    ).toBeOnTheScreen();
  });
});
