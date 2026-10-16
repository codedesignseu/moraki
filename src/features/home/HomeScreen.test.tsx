import { act, fireEvent, render, screen, within } from '@testing-library/react-native';
import { randomBytes } from 'node:crypto';

import {
  DevicePrefsProvider,
  EventsRepositoryProvider,
  SyncRepositoriesProvider,
  type AppRepositories,
} from '@/db/react';
import { UndoProvider } from '@/db/undo';
import {
  createDevicePrefsRepository,
  type DevicePrefsRepository,
} from '@/db/repositories/devicePrefs';
import { createEventsRepository, type EventsRepository } from '@/db/repositories/events';
import { createMemoryDb } from '@/db/testing/memoryDb';
import { newId } from '@/domain/ids';
import '@/i18n';
import { ThemeProvider } from '@/ui/theme';

import { HomeScreen, type LogKind } from './HomeScreen';

jest.mock('@/ui/deviceTimeZone', () => ({ deviceTimeZone: () => 'Europe/Nicosia' }));

const MIN = 60_000;
const HOUR = 60 * MIN;
const NOW = Date.parse('2026-07-01T09:00:00Z'); // 12:00 in Nicosia

let repo: EventsRepository;
let prefs: DevicePrefsRepository;

beforeEach(async () => {
  jest.useRealTimers();
  const { db } = await createMemoryDb();
  // Fake timers also fake Date.now, so the timer, the repository clock and the test agree.
  jest.useFakeTimers({ now: NOW });
  repo = createEventsRepository(db, {
    now: Date.now,
    newId: (at) => newId(at, () => new Uint8Array(randomBytes(16))),
  });
  // Home reads the household's feed interval from here (P1-15).
  prefs = createDevicePrefsRepository(db);
});

afterEach(() => {
  jest.useRealTimers();
});

const renderHome = (onLog?: (kind: LogKind) => void) =>
  render(
    <ThemeProvider scheme="light">
      <EventsRepositoryProvider repository={repo}>
        <DevicePrefsProvider repository={prefs}>
          <UndoProvider>
            <HomeScreen {...(onLog && { onLog })} />
          </UndoProvider>
        </DevicePrefsProvider>
      </EventsRepositoryProvider>
    </ThemeProvider>,
  );

const ME = '0190a0b0-0000-7000-8000-00000000000a';

/** Home with a household on this phone and caregiver names from sync. */
const renderWithHousehold = (names: Record<string, string>) => {
  prefs.set('accountHousehold', {
    userId: ME,
    householdId: '0190a0b0-0000-7000-8000-000000000a01',
    babyId: '0190a0b0-0000-7000-8000-000000000b01',
    babyName: 'Ella',
    role: 'owner',
  });
  const caregivers = {
    names: () => new Map(Object.entries(names)),
    subscribe: () => () => {},
    version: () => 0,
  };
  return render(
    <ThemeProvider scheme="light">
      <EventsRepositoryProvider repository={repo}>
        <DevicePrefsProvider repository={prefs}>
          <SyncRepositoriesProvider repositories={{ caregivers } as unknown as AppRepositories}>
            <UndoProvider>
              <HomeScreen />
            </UndoProvider>
          </SyncRepositoriesProvider>
        </DevicePrefsProvider>
      </EventsRepositoryProvider>
    </ThemeProvider>,
  );
};

const bottle = (occurredAt: number, ml = 90) =>
  repo.insert({ type: 'feed_bottle', occurredAt, payload: { ml, milk: 'formula' } });

const advance = (ms: number) =>
  act(async () => {
    jest.advanceTimersByTime(ms);
  });

describe('HomeScreen', () => {
  it('shows empty states before anything is logged', async () => {
    await renderHome();
    expect(screen.getByText('No feed yet')).toBeOnTheScreen();
    expect(screen.getByText('Log the first one when it happens')).toBeOnTheScreen();
    expect(screen.getByText('Nothing logged yet')).toBeOnTheScreen();
  });

  it('ticks the timer every 30 seconds, not before', async () => {
    bottle(NOW - (42 * MIN + 45_000));
    await renderHome();
    expect(screen.getByRole('timer')).toHaveTextContent('42 min');

    // 15s later the true elapsed time is 43m, but the timer hasn't ticked yet.
    await advance(15_000);
    expect(screen.getByRole('timer')).toHaveTextContent('42 min');

    await advance(15_000);
    expect(screen.getByRole('timer')).toHaveTextContent('43 min');

    await advance(30_000);
    expect(screen.getByRole('timer')).toHaveTextContent('43 min');
    await advance(30_000);
    expect(screen.getByRole('timer')).toHaveTextContent('44 min');
  });

  it('updates instantly when something is logged, without waiting for a tick', async () => {
    bottle(NOW - 2 * HOUR, 60);
    await renderHome();
    expect(screen.getByRole('timer')).toHaveTextContent('2 h 0 min');

    await act(async () => {
      bottle(NOW, 120);
    });

    expect(screen.getByRole('timer')).toHaveTextContent('0 min');
    expect(screen.getByLabelText('Feeds: 2')).toBeOnTheScreen();
    expect(screen.getByLabelText('mL: 180')).toBeOnTheScreen();
    const recent = within(screen.getByTestId('home-recent'));
    expect(recent.getAllByText('Bottle')).toHaveLength(2);
    expect(recent.getByText('120 mL formula')).toBeOnTheScreen();
  });

  it('shows the next side and the reminder time in local time', async () => {
    repo.insert({ type: 'feed_breast', occurredAt: NOW - HOUR, payload: { side: 'left' } });
    await renderHome();
    expect(screen.getByText('Next side: right')).toBeOnTheScreen();
    // Fed at 11:00 local, default interval 180 minutes.
    expect(screen.getByText('Feed reminder at 14:00')).toBeOnTheScreen();
  });

  it('says the reminder time has passed once it has', async () => {
    bottle(NOW - 4 * HOUR);
    await renderHome();
    expect(screen.getByText('Feed reminder was at 11:00')).toBeOnTheScreen();
  });

  it('fills the today strip and the 24 hour sleep line', async () => {
    repo.insert({ type: 'diaper', occurredAt: NOW - HOUR, payload: { kind: 'both' } });
    repo.insert({ type: 'sleep', occurredAt: NOW - 3 * HOUR, endedAt: NOW - HOUR, payload: {} });
    await renderHome();
    expect(screen.getByLabelText('Wet: 1')).toBeOnTheScreen();
    expect(screen.getByLabelText('Dirty: 1')).toBeOnTheScreen();
    expect(screen.getByText('Sleep in the last 24h: 2h 0m')).toBeOnTheScreen();
  });

  it('shows breastfeeding time next to bottle mL, as separate figures (P1-F10)', async () => {
    repo.insertGroup([
      { type: 'feed_bottle', occurredAt: NOW - HOUR, payload: { ml: 90, milk: 'formula' } },
      {
        type: 'feed_breast',
        occurredAt: NOW - HOUR,
        endedAt: NOW - 35 * MIN,
        payload: { side: 'left' },
      },
    ]);
    await renderHome();
    expect(screen.getByLabelText('Feeds: 1')).toBeOnTheScreen();
    expect(screen.getByLabelText('mL: 90')).toBeOnTheScreen();
    expect(screen.getByLabelText('Breastfeeding: 25m')).toBeOnTheScreen();
  });

  it('shows 0m breastfeeding on a day without any', async () => {
    bottle(NOW - HOUR, 60);
    await renderHome();
    expect(screen.getByLabelText('Breastfeeding: 0m')).toBeOnTheScreen();
  });

  it('lists the 6 most recent entries, newest first, with time and author', async () => {
    for (let i = 1; i <= 8; i += 1) bottle(NOW - i * HOUR, 10 * i);
    await renderHome();
    const recent = within(screen.getByTestId('home-recent'));
    expect(recent.getAllByText('Bottle')).toHaveLength(6);
    expect(recent.getAllByText(/mL formula/).map((n) => n.props.children)).toEqual([
      '10 mL formula',
      '20 mL formula',
      '30 mL formula',
      '40 mL formula',
      '50 mL formula',
      '60 mL formula',
    ]);
    expect(recent.getByText('11:00')).toBeOnTheScreen();
    expect(recent.getAllByText('You')).toHaveLength(6);
  });

  it('marks entries from yesterday', async () => {
    bottle(Date.parse('2026-06-30T19:30:00Z')); // 22:30 local the day before
    await renderHome();
    expect(screen.getByText('Yesterday 22:30')).toBeOnTheScreen();
  });

  // An appointment is the one entry that can be in the future (found on a
  // real phone: a visit booked weeks out read as "402 days ago" in Recent,
  // because dayBucket's daysAgo goes negative and nothing handled that sign).
  it('marks an appointment tomorrow as tomorrow, not "-1 days ago"', async () => {
    repo.insert({
      type: 'appointment',
      occurredAt: Date.parse('2026-07-02T07:30:00Z'), // 10:30 local, next day
      payload: { title: 'Check-up' },
    });
    await renderHome();
    expect(screen.getByText('Tomorrow 10:30')).toBeOnTheScreen();
    expect(screen.queryByText(/ago/)).toBeNull();
  });

  it('marks an appointment further out as "in N days", not a huge wrong past count', async () => {
    repo.insert({
      type: 'appointment',
      occurredAt: NOW + 55 * 24 * HOUR,
      payload: { title: 'Vaccination' },
    });
    await renderHome();
    expect(screen.getByText(/^In 55 days, /)).toBeOnTheScreen();
    expect(screen.queryByText(/ago/)).toBeNull();
  });

  describe('greeting (direction G)', () => {
    it('says hello by name and names the baby', async () => {
      await renderWithHousehold({ [ME]: 'Makis' });
      expect(screen.getByRole('header', { name: 'Hello, Makis' })).toBeOnTheScreen();
      expect(screen.getByText('Here’s Ella’s day so far')).toBeOnTheScreen();
    });

    it('says plain hello when the account has no name yet', async () => {
      await renderWithHousehold({});
      expect(screen.getByRole('header', { name: 'Hello' })).toBeOnTheScreen();
      expect(screen.getByText('Here’s Ella’s day so far')).toBeOnTheScreen();
    });

    it('says plain hello on a phone with no household', async () => {
      await renderHome();
      expect(screen.getByRole('header', { name: 'Hello' })).toBeOnTheScreen();
      expect(screen.getByText('Here’s the day so far')).toBeOnTheScreen();
    });
  });

  describe('hero and tiles (direction G)', () => {
    it('opens the feed sheet from "Log a feed" and each tile', async () => {
      const onLog = jest.fn();
      await renderHome(onLog);
      await fireEvent.press(screen.getByRole('button', { name: 'Log a feed' }));
      await fireEvent.press(screen.getByRole('button', { name: 'Log feed' }));
      await fireEvent.press(screen.getByRole('button', { name: 'Sleep' }));
      await fireEvent.press(screen.getByRole('button', { name: 'Diaper' }));
      await fireEvent.press(screen.getByRole('button', { name: 'Pump' }));
      expect(onLog.mock.calls).toEqual([['feed'], ['feed'], ['sleep'], ['diaper'], ['pump']]);
    });

    it('says "Not yet" on every tile before anything is logged', async () => {
      await renderHome(jest.fn());
      for (const name of ['Log feed', 'Sleep', 'Diaper', 'Pump']) {
        expect(screen.getByRole('button', { name })).toHaveAccessibilityValue({ text: 'Not yet' });
      }
    });

    it('gives each tile its last time, and the sleep tile the time awake', async () => {
      bottle(NOW - 2 * HOUR); // 10:00 local
      repo.insert({ type: 'diaper', occurredAt: NOW - 30 * MIN, payload: { kind: 'wet' } });
      repo.insert({
        type: 'pump',
        occurredAt: Date.parse('2026-06-30T19:30:00Z'), // yesterday, local
        payload: { ml: 80, dest: 'fridge' },
      });
      repo.insert({
        type: 'sleep',
        occurredAt: NOW - 3 * HOUR,
        endedAt: NOW - 65 * MIN,
        payload: {},
      });
      await renderHome(jest.fn());
      expect(screen.getByRole('button', { name: 'Log feed' })).toHaveAccessibilityValue({
        text: 'Last 10:00',
      });
      expect(screen.getByRole('button', { name: 'Diaper' })).toHaveAccessibilityValue({
        text: 'Last 11:30',
      });
      expect(screen.getByRole('button', { name: 'Pump' })).toHaveAccessibilityValue({
        text: 'Last yesterday',
      });
      expect(screen.getByRole('button', { name: 'Sleep' })).toHaveAccessibilityValue({
        text: 'Awake 1 h 05',
      });
    });

    it('says "Sleeping" on the sleep tile while a sleep runs', async () => {
      repo.insert({ type: 'sleep', occurredAt: NOW - 20 * MIN, payload: {} });
      await renderHome(jest.fn());
      expect(screen.getByRole('button', { name: 'Sleep' })).toHaveAccessibilityValue({
        text: 'Sleeping',
      });
    });
  });
});
