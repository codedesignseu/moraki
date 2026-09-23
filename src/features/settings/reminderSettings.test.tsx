import { fireEvent, screen, waitFor, within } from 'expo-router/testing-library';

import type { DevicePrefsRepository } from '@/db/repositories/devicePrefs';
import type { EventsRepository } from '@/db/repositories/events';
import { createHarness, renderApp } from '@/testing/appHarness';
import { createFakeNotifications } from '@/testing/fakeNotifications';

jest.mock('@/ui/deviceTimeZone', () => ({ deviceTimeZone: () => 'Europe/Nicosia' }));

const MIN = 60_000;
const HOUR = 60 * MIN;
const NOW = Date.parse('2026-10-28T12:00:00Z');

let repo: EventsRepository;
let prefs: DevicePrefsRepository;

beforeEach(async () => {
  ({ repo, prefs } = await createHarness(NOW));
});
afterEach(() => {
  jest.useRealTimers();
});

const press = (name: string | RegExp) => fireEvent.press(screen.getByRole('button', { name }));
const card = async () => within(await screen.findByTestId('settings-reminders'));
/** A Stepper is adjustable: nudged the way a screen reader nudges it. */
const step = async (label: string, direction: 'more' | 'less', times = 1) => {
  for (let i = 0; i < times; i += 1) {
    // Re-read each time: the card re-renders, and the old node is detached.
    await fireEvent((await card()).getByLabelText(label), 'accessibilityAction', {
      nativeEvent: { actionName: direction === 'more' ? 'increment' : 'decrement' },
    });
  }
};

const aFeedAnHourAgo = () =>
  repo.insert({
    type: 'feed_bottle',
    occurredAt: NOW - HOUR,
    payload: { ml: 90, milk: 'formula' },
  });

describe('the feed interval', () => {
  it('starts at the household default of three hours', async () => {
    aFeedAnHourAgo();
    await renderApp(repo);
    // Fed at 13:00 local (UTC+2), three hours on: home says 16:00.
    expect(await screen.findByText('Feed reminder at 16:00')).toBeOnTheScreen();
  });

  it('reschedules the notification the moment it changes', async () => {
    aFeedAnHourAgo();
    prefs.set('reminders', true);
    const os = createFakeNotifications();
    await renderApp(repo, { notifications: os });
    await waitFor(() => expect(os.held()).toHaveLength(1));
    expect(os.held()[0]?.at).toBe(NOW - HOUR + 3 * HOUR);

    await press(/Settings/);
    await step('Remind me this long after a feed', 'more', 4); // 180 → 240, in steps of 15

    // No save button, no reopening the app: the phone holds the new time.
    await waitFor(() => expect(os.held()[0]?.at).toBe(NOW - HOUR + 4 * HOUR));
    expect(os.held()).toHaveLength(1);
    expect(prefs.get('reminderIntervalMin')).toBe(240);
  });

  it('moves the line on home too, so the two never disagree', async () => {
    aFeedAnHourAgo();
    await renderApp(repo);
    await press(/Settings/);
    await step('Remind me this long after a feed', 'more', 4); // 240 minutes

    await press(/Home/);
    expect(await screen.findByText('Feed reminder at 17:00')).toBeOnTheScreen();
  });

  it('stays inside the range the household allows', async () => {
    await renderApp(repo);
    await press(/Settings/);
    await step('Remind me this long after a feed', 'less', 20);
    expect(prefs.get('reminderIntervalMin')).toBe(60);

    await step('Remind me this long after a feed', 'more', 40);
    expect(prefs.get('reminderIntervalMin')).toBe(480);
  });
});

describe('the second reminder', () => {
  it('is off until someone asks for it', async () => {
    aFeedAnHourAgo();
    prefs.set('reminders', true);
    const os = createFakeNotifications();
    await renderApp(repo, { notifications: os });

    await waitFor(() => expect(os.held()).toHaveLength(1));
    expect(prefs.get('secondReminderMin')).toBe(null);
  });

  it('adds a second notification after the first, and takes it away again', async () => {
    aFeedAnHourAgo();
    prefs.set('reminders', true);
    const os = createFakeNotifications();
    await renderApp(repo, { notifications: os });
    await waitFor(() => expect(os.held()).toHaveLength(1));

    await press(/Settings/);
    await fireEvent.press((await card()).getByRole('radio', { name: 'Yes' }));

    await waitFor(() => expect(os.held()).toHaveLength(2));
    const [first, second] = os.held();
    expect(second?.at).toBe((first?.at ?? 0) + 15 * MIN);
    expect(second?.body).toBe('No feed logged since 13:00');

    await fireEvent.press((await card()).getByRole('radio', { name: 'No' }));
    await waitFor(() => expect(os.held()).toHaveLength(1));
  });

  it('moves the second one when its delay changes', async () => {
    aFeedAnHourAgo();
    prefs.set('reminders', true);
    prefs.set('secondReminderMin', 15);
    const os = createFakeNotifications();
    await renderApp(repo, { notifications: os });
    await waitFor(() => expect(os.held()).toHaveLength(2));

    await press(/Settings/);
    await step('Second reminder, this long after the first', 'more', 1); // 15 → 30

    await waitFor(() => expect(os.held()[1]?.at).toBe(NOW - HOUR + 3 * HOUR + 30 * MIN));
    expect(os.held()).toHaveLength(2);
  });
});

describe('whose setting it is', () => {
  it('says it applies to this phone when there is no household', async () => {
    await renderApp(repo);
    await press(/Settings/);
    expect(
      (await card()).getByText('This applies to your reminders on this phone.'),
    ).toBeOnTheScreen();
  });
});
