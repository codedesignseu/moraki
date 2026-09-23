import { fireEvent, screen, waitFor, within } from 'expo-router/testing-library';

import type { DevicePrefsRepository } from '@/db/repositories/devicePrefs';
import type { EventsRepository } from '@/db/repositories/events';
import { createHarness, renderApp } from '@/testing/appHarness';
import { createFakeNotifications } from '@/testing/fakeNotifications';

jest.mock('@/ui/deviceTimeZone', () => ({ deviceTimeZone: () => 'Europe/Nicosia' }));

const MIN = 60_000;
const HOUR = 60 * MIN;
/** The household default is a 3 hour interval (SDD 4.2). */
const INTERVAL = 3 * HOUR;
const NOW = Date.parse('2026-10-28T12:00:00Z');

let repo: EventsRepository;
let prefs: DevicePrefsRepository;

beforeEach(async () => {
  ({ repo, prefs } = await createHarness(NOW));
});
afterEach(() => {
  jest.useRealTimers();
});

const onByDefault = () => prefs.set('reminders', true);
const press = (name: string | RegExp) => fireEvent.press(screen.getByRole('button', { name }));
/** Night mode has On and Off too, so the switch is found inside its own card. */
const remindersCard = async () => within(await screen.findByTestId('settings-reminders'));
const setReminders = async (choice: 'On' | 'Off') =>
  fireEvent.press((await remindersCard()).getByRole('radio', { name: choice }));

describe('reminders this phone schedules', () => {
  it('schedules nothing until someone asks for them', async () => {
    repo.insert({
      type: 'feed_bottle',
      occurredAt: NOW - HOUR,
      payload: { ml: 90, milk: 'formula' },
    });
    const os = createFakeNotifications();

    await renderApp(repo, { notifications: os });

    await waitFor(() => expect(os.calls).toEqual([]));
    expect(os.held()).toEqual([]);
  });

  it('schedules the next feed when they are on, at the interval after the last feed', async () => {
    repo.insert({
      type: 'feed_bottle',
      occurredAt: NOW - HOUR,
      payload: { ml: 90, milk: 'formula' },
    });
    onByDefault();
    const os = createFakeNotifications();

    await renderApp(repo, { notifications: os });

    await waitFor(() => expect(os.held()).toHaveLength(1));
    expect(os.held()[0]).toMatchObject({
      id: 'feed:first',
      category: 'feed',
      at: NOW - HOUR + INTERVAL,
      body: 'Next feed may be due',
    });
  });

  it('moves it when a feed is logged again, without leaving the old one behind', async () => {
    repo.insert({
      type: 'feed_bottle',
      occurredAt: NOW - HOUR,
      payload: { ml: 90, milk: 'formula' },
    });
    onByDefault();
    const os = createFakeNotifications();
    await renderApp(repo, { notifications: os });
    await waitFor(() => expect(os.held()).toHaveLength(1));

    repo.insert({ type: 'feed_bottle', occurredAt: NOW, payload: { ml: 100, milk: 'formula' } });

    await waitFor(() => expect(os.held()[0]?.at).toBe(NOW + INTERVAL));
    // One reminder, not two: the old one was cancelled.
    expect(os.held()).toHaveLength(1);
  });

  it('leaves an unchanged reminder alone when something else is logged', async () => {
    repo.insert({
      type: 'feed_bottle',
      occurredAt: NOW - HOUR,
      payload: { ml: 90, milk: 'formula' },
    });
    onByDefault();
    const os = createFakeNotifications();
    await renderApp(repo, { notifications: os });
    await waitFor(() => expect(os.held()).toHaveLength(1));
    const before = [...os.calls];

    repo.insert({ type: 'diaper', occurredAt: NOW, payload: { kind: 'wet' } });

    // A diaper doesn't move the feed reminder, so nothing is cancelled or
    // placed again: a busy morning shouldn't churn the phone's queue.
    await waitFor(() => expect(os.calls).toEqual(before));
    expect(os.held()).toHaveLength(1);
  });

  it('clears everything when they are turned off', async () => {
    repo.insert({
      type: 'feed_bottle',
      occurredAt: NOW - HOUR,
      payload: { ml: 90, milk: 'formula' },
    });
    onByDefault();
    const os = createFakeNotifications();
    await renderApp(repo, { notifications: os });
    await waitFor(() => expect(os.held()).toHaveLength(1));

    await press(/Settings/);
    await setReminders('Off');

    await waitFor(() => expect(os.held()).toEqual([]));
  });

  it('schedules nothing when nothing has been fed yet', async () => {
    onByDefault();
    const os = createFakeNotifications();

    await renderApp(repo, { notifications: os });

    await waitFor(() => expect(os.calls).toEqual([]));
  });

  it('schedules nothing for a feed whose reminder time has already passed', async () => {
    // Logged four hours ago with a three hour interval: the moment is gone.
    repo.insert({
      type: 'feed_bottle',
      occurredAt: NOW - 4 * HOUR,
      payload: { ml: 90, milk: 'formula' },
    });
    onByDefault();
    const os = createFakeNotifications();

    await renderApp(repo, { notifications: os });

    await waitFor(() => expect(os.calls).toEqual([]));
  });

  it('schedules nothing when the phone has taken permission away', async () => {
    // Switched on here, then turned off in the phone's own settings: nothing
    // can be delivered, so nothing is queued to be.
    repo.insert({
      type: 'feed_bottle',
      occurredAt: NOW - HOUR,
      payload: { ml: 90, milk: 'formula' },
    });
    onByDefault();
    const os = createFakeNotifications('denied');

    await renderApp(repo, { notifications: os });

    await waitFor(() => expect(os.calls).toEqual([]));
    expect(os.held()).toEqual([]);
  });

  it('says nothing about the baby in what shows on a lock screen', async () => {
    repo.insert({
      type: 'feed_bottle',
      occurredAt: NOW - HOUR,
      payload: { ml: 175, milk: 'formula' },
    });
    onByDefault();
    const os = createFakeNotifications();

    await renderApp(repo, { notifications: os });

    await waitFor(() => expect(os.held()).toHaveLength(1));
    const { title, body } = os.held()[0] ?? { title: '', body: '' };
    expect(`${title} ${body}`).not.toMatch(/175|mL|formula|diaper|weight|temp/i);
  });
});

describe('asking the phone for permission', () => {
  it('asks only when someone turns them on', async () => {
    const os = createFakeNotifications('undetermined');
    await renderApp(repo, { notifications: os });
    await press(/Settings/);
    await remindersCard();
    expect(os.calls).toEqual([]);

    await setReminders('On');

    await waitFor(() => expect(os.calls).toContain('request'));
  });

  it('turns them on once the phone says yes', async () => {
    repo.insert({
      type: 'feed_bottle',
      occurredAt: NOW - HOUR,
      payload: { ml: 90, milk: 'formula' },
    });
    const os = createFakeNotifications('undetermined');
    os.answer('granted');
    await renderApp(repo, { notifications: os });
    await press(/Settings/);

    await setReminders('On');

    await waitFor(() => expect(os.held()).toHaveLength(1));
    expect(prefs.get('reminders')).toBe(true);
  });

  it('stays off, and says why, when the phone says no', async () => {
    repo.insert({
      type: 'feed_bottle',
      occurredAt: NOW - HOUR,
      payload: { ml: 90, milk: 'formula' },
    });
    const os = createFakeNotifications('undetermined');
    os.answer('denied');
    await renderApp(repo, { notifications: os });
    await press(/Settings/);

    await setReminders('On');

    // A switch that said On while the phone delivers nothing would be a lie.
    await waitFor(() => expect(prefs.get('reminders')).toBe(false));
    expect(
      within(screen.getByTestId('settings-reminders')).getByText(
        'Notifications are off for Moraki in your phone’s settings. Turn them on there first.',
      ),
    ).toBeOnTheScreen();
    expect(os.held()).toEqual([]);
  });
});
