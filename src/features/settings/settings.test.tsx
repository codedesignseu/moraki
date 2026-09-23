import { act, fireEvent, screen, within } from 'expo-router/testing-library';
import { AppState, type AppStateStatus } from 'react-native';

import { createHarness, renderApp, type Harness } from '@/testing/appHarness';
import { colors, typography } from '@/ui/tokens';

import { MAX_NIGHT_CHECK_MS } from './useNightScheme';

let mockTimeZone = 'Europe/Nicosia';
jest.mock('@/ui/deviceTimeZone', () => ({ deviceTimeZone: () => mockTimeZone }));

const MIN = 60_000;
const HOUR = 60 * MIN;
// Nicosia is UTC+3 in summer.
const EVENING = Date.parse('2026-07-01T17:59:00Z'); // 20:59 local
const NOON = Date.parse('2026-07-01T09:00:00Z');

let h: Harness;
afterEach(() => {
  mockTimeZone = 'Europe/Nicosia';
  jest.useRealTimers();
  jest.restoreAllMocks();
});

/** `beforeRender` runs once the fake clock is installed, e.g. to spy on timers. */
async function openSettings(now: number, beforeRender?: () => void) {
  h = await createHarness(now);
  beforeRender?.();
  await renderApp(h.repo);
  await fireEvent.press(screen.getByRole('button', { name: /Settings/ }));
}

const card = () => screen.getByTestId('settings-night-mode');
const scheme = () => {
  const { backgroundColor } = card().props.style as { backgroundColor: string };
  if (backgroundColor === colors.night.surface) return 'night';
  if (backgroundColor === colors.light.surface) return 'light';
  throw new Error(`Card background ${backgroundColor} is in neither palette`);
};
// Reminders has On and Off too (P1-14), so night mode's are found in its card.
const option = (name: string) => within(card()).getByRole('radio', { name });
/** Moves the fake clock forward, firing the app's timers on the way, as a running phone would. */
const advance = (ms: number) => act(async () => jest.advanceTimersByTime(ms));

describe('night mode setting', () => {
  it('is a three-way control on the Settings tab, auto by default', async () => {
    await openSettings(NOON);
    expect(screen.getByLabelText('Night mode')).toBeOnTheScreen();
    expect(option('Auto')).toBeChecked();
    expect(option('On')).not.toBeChecked();
    expect(option('Off')).not.toBeChecked();
    expect(screen.getByText('Dark screens from 21:00 to 06:00.')).toBeOnTheScreen();
  });

  it('forces night on at noon and off at midnight, and stores the choice on this phone', async () => {
    await openSettings(NOON);
    expect(scheme()).toBe('light');
    await fireEvent.press(option('On'));
    expect(scheme()).toBe('night');
    expect(h.prefs.get('nightMode')).toBe('on');

    await advance(12 * HOUR); // 00:00 local
    expect(scheme()).toBe('night');
    await fireEvent.press(option('Off'));
    expect(scheme()).toBe('light');
    expect(h.prefs.get('nightMode')).toBe('off');
    await fireEvent.press(option('Auto'));
    expect(scheme()).toBe('night');
  });

  it('in auto, switches at 21:00 and back at 06:00 while the app stays open', async () => {
    await openSettings(EVENING);
    expect(scheme()).toBe('light');

    await advance(MIN - 1); // 20:59:59.999
    expect(scheme()).toBe('light');
    await advance(1); // 21:00
    expect(scheme()).toBe('night');

    await advance(9 * HOUR - 1); // 05:59:59.999
    expect(scheme()).toBe('night');
    await advance(1); // 06:00
    expect(scheme()).toBe('light');
  });

  it('switches at 06:00 local, 10 hours later, on the night Nicosia clocks go back', async () => {
    await openSettings(Date.parse('2026-10-24T18:00:00Z')); // 21:00 UTC+3, 24 October
    expect(scheme()).toBe('night');
    await advance(10 * HOUR - 1); // 05:59:59.999 UTC+2
    expect(scheme()).toBe('night');
    await advance(1); // 06:00 UTC+2
    expect(scheme()).toBe('light');
  });

  it('re-reads the clock on returning to the foreground, without waiting for the timer', async () => {
    const listeners: ((state: AppStateStatus) => void)[] = [];
    jest.spyOn(AppState, 'addEventListener').mockImplementation((type, listener) => {
      if (type === 'change') listeners.push(listener as (state: AppStateStatus) => void);
      return { remove: jest.fn() };
    });
    await openSettings(NOON);
    expect(scheme()).toBe('light');

    // Backgrounded until 22:00: the clock moved but no timer ran.
    jest.setSystemTime(Date.parse('2026-07-01T19:00:00Z'));
    expect(scheme()).toBe('light');
    await act(async () => listeners.forEach((listener) => listener('active')));
    expect(scheme()).toBe('night');
  });

  it("follows a timezone change within the hour, not at the old zone's 21:00", async () => {
    await openSettings(NOON); // 12:00 Nicosia: its 21:00 is 9 hours away
    mockTimeZone = 'Asia/Tokyo'; // 18:00 in Tokyo (UTC+9): its 21:00 is 12:00Z
    await advance(3 * HOUR - 1);
    expect(scheme()).toBe('light');
    await advance(MAX_NIGHT_CHECK_MS);
    expect(scheme()).toBe('night');
  });

  it('lands on the dark warm palette with the same text sizes in auto at night', async () => {
    await openSettings(Date.parse('2026-07-01T20:00:00Z')); // 23:00 local
    expect(scheme()).toBe('night');
    const heading = screen.getByText('Night mode', { exact: true });
    expect(heading).toHaveStyle({
      color: colors.night.text,
      fontSize: typography.heading.fontSize,
    });
    for (const value of Object.values(colors.night)) {
      expect(value.toUpperCase()).not.toBe('#FFFFFF');
    }
  });
});
