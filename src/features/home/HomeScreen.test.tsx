import { act, render, screen, within } from '@testing-library/react-native';
import { randomBytes } from 'node:crypto';

import { EventsRepositoryProvider } from '@/db/react';
import { UndoProvider } from '@/db/undo';
import { createEventsRepository, type EventsRepository } from '@/db/repositories/events';
import { createMemoryDb } from '@/db/testing/memoryDb';
import { newId } from '@/domain/ids';
import '@/i18n';
import { ThemeProvider } from '@/ui/theme';

import { HomeScreen } from './HomeScreen';

jest.mock('@/ui/deviceTimeZone', () => ({ deviceTimeZone: () => 'Europe/Nicosia' }));

const MIN = 60_000;
const HOUR = 60 * MIN;
const NOW = Date.parse('2026-07-01T09:00:00Z'); // 12:00 in Nicosia

let repo: EventsRepository;

beforeEach(async () => {
  jest.useRealTimers();
  const { db } = await createMemoryDb();
  // Fake timers also fake Date.now, so the timer, the repository clock and the test agree.
  jest.useFakeTimers({ now: NOW });
  repo = createEventsRepository(db, {
    now: Date.now,
    newId: (at) => newId(at, () => new Uint8Array(randomBytes(16))),
  });
});

afterEach(() => {
  jest.useRealTimers();
});

const renderHome = () =>
  render(
    <ThemeProvider scheme="light">
      <EventsRepositoryProvider repository={repo}>
        <UndoProvider>
          <HomeScreen />
        </UndoProvider>
      </EventsRepositoryProvider>
    </ThemeProvider>,
  );

const bottle = (occurredAt: number, ml = 90) =>
  repo.insert({ type: 'feed_bottle', occurredAt, payload: { ml, milk: 'formula' } });

const advance = (ms: number) =>
  act(async () => {
    jest.advanceTimersByTime(ms);
  });

describe('HomeScreen', () => {
  it('shows empty states before anything is logged', async () => {
    await renderHome();
    expect(screen.getByText('No feed logged yet')).toBeOnTheScreen();
    expect(screen.getByText('Nothing logged yet')).toBeOnTheScreen();
  });

  it('ticks the timer every 30 seconds, not before', async () => {
    bottle(NOW - (42 * MIN + 45_000));
    await renderHome();
    expect(screen.getByRole('timer')).toHaveTextContent('42m');

    // 15s later the true elapsed time is 43m, but the timer hasn't ticked yet.
    await advance(15_000);
    expect(screen.getByRole('timer')).toHaveTextContent('42m');

    await advance(15_000);
    expect(screen.getByRole('timer')).toHaveTextContent('43m');

    await advance(30_000);
    expect(screen.getByRole('timer')).toHaveTextContent('43m');
    await advance(30_000);
    expect(screen.getByRole('timer')).toHaveTextContent('44m');
  });

  it('updates instantly when something is logged, without waiting for a tick', async () => {
    bottle(NOW - 2 * HOUR, 60);
    await renderHome();
    expect(screen.getByRole('timer')).toHaveTextContent('2h 0m');

    await act(async () => {
      bottle(NOW, 120);
    });

    expect(screen.getByRole('timer')).toHaveTextContent('0m');
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
});
