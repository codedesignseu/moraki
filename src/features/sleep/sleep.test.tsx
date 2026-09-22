import { act, cleanup, fireEvent, screen, within } from 'expo-router/testing-library';

import type { Event } from '@/domain/activities';
import { createHarness, renderApp, type Harness } from '@/testing/appHarness';

jest.mock('@/ui/deviceTimeZone', () => ({ deviceTimeZone: () => 'Europe/Nicosia' }));

const MIN = 60_000;
const NOW = Date.parse('2026-07-01T09:00:00Z'); // 12:00 in Nicosia

let h: Harness;

beforeEach(async () => {
  h = await createHarness(NOW);
});

afterEach(() => {
  jest.useRealTimers();
});

const sleeps = (harness = h) =>
  harness.repo.list().filter((e) => e.type === 'sleep') as Event<unknown>[];
const card = () => within(screen.getByTestId('home-sleep'));

async function startSleepFromHome() {
  await fireEvent.press(screen.getByRole('button', { name: 'Sleep' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Start sleep now' }));
}

describe('sleep', () => {
  it('starts from home in two taps and shows a running sleep card', async () => {
    await renderApp(h.repo);
    expect(screen.queryByTestId('home-sleep')).toBeNull();

    await startSleepFromHome();

    expect(sleeps()).toEqual([expect.objectContaining({ occurredAt: NOW, endedAt: null })]);
    expect(card().getByText('Sleeping since 12:00')).toBeOnTheScreen();
    expect(card().getByRole('timer')).toHaveTextContent('0m');
  });

  it('counts the running sleep up on the 30 second tick', async () => {
    h.repo.insert({ type: 'sleep', occurredAt: NOW - 20 * MIN, payload: {} });
    await renderApp(h.repo);
    expect(card().getByRole('timer')).toHaveTextContent('20m');
    await jestAdvance(10 * MIN);
    expect(card().getByRole('timer')).toHaveTextContent('30m');
  });

  it('stops from the home card', async () => {
    const { id } = h.repo.insert({ type: 'sleep', occurredAt: NOW - 50 * MIN, payload: {} });
    await renderApp(h.repo);
    await fireEvent.press(card().getByRole('button', { name: 'Stop sleep' }));

    expect(h.repo.get(id)?.endedAt).toBe(NOW);
    expect(screen.queryByTestId('home-sleep')).toBeNull();
    expect(screen.getByText('Sleep in the last 24h: 50m')).toBeOnTheScreen();
  });

  it('stops from the sheet when a sleep is running', async () => {
    const { id } = h.repo.insert({ type: 'sleep', occurredAt: NOW - 30 * MIN, payload: {} });
    await renderApp(h.repo);
    await fireEvent.press(screen.getByRole('button', { name: 'Sleep' }));
    expect(screen.getByText('Sleeping since 11:30')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Start sleep now' })).toBeNull();
    await fireEvent.press(screen.getAllByRole('button', { name: 'Stop sleep' }).at(-1)!);
    expect(h.repo.get(id)?.endedAt).toBe(NOW);
  });

  it('adds a past sleep from manual entry', async () => {
    await renderApp(h.repo);
    await fireEvent.press(screen.getByRole('button', { name: 'Sleep' }));
    // Started 65 minutes ago, slept 45 minutes: 10:55 to 11:40 local.
    await fireEvent(screen.getByLabelText('Started this long ago'), 'accessibilityAction', {
      nativeEvent: { actionName: 'increment' },
    });
    expect(screen.getByText('10:55 to 11:40')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Save past sleep' }));

    expect(sleeps()).toEqual([
      expect.objectContaining({ occurredAt: NOW - 65 * MIN, endedAt: NOW - 20 * MIN }),
    ]);
    expect(screen.queryByTestId('home-sleep')).toBeNull();
  });

  it('never lets a past sleep end after the sheet opened', async () => {
    await renderApp(h.repo);
    await fireEvent.press(screen.getByRole('button', { name: 'Sleep' }));
    for (let i = 0; i < 4; i += 1) {
      await fireEvent(screen.getByLabelText('Started this long ago'), 'accessibilityAction', {
        nativeEvent: { actionName: 'decrement' },
      });
    }
    // Started 40 minutes ago: the 45 minute default shrinks to 40.
    expect(screen.getByText('11:20 to 12:00')).toBeOnTheScreen();
  });

  it('caps the duration so a past sleep ends by the time the sheet opened', async () => {
    await renderApp(h.repo);
    await fireEvent.press(screen.getByRole('button', { name: 'Sleep' }));
    // Started 60 minutes ago; try to push the 45 minute duration to 70.
    for (let i = 0; i < 5; i += 1) {
      await fireEvent(screen.getByLabelText('Slept for'), 'accessibilityAction', {
        nativeEvent: { actionName: 'increment' },
      });
    }
    expect(screen.getByText('11:00 to 12:00')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Save past sleep' }));
    expect(sleeps()[0]).toMatchObject({ occurredAt: NOW - 60 * MIN, endedAt: NOW });
  });

  it('survives an app kill: the running sleep comes back from the stored events alone', async () => {
    await renderApp(h.repo);
    await startSleepFromHome();
    expect(card().getByRole('timer')).toHaveTextContent('0m');

    // Kill: tear down every screen, keep only the database file's bytes, and
    // close the database so nothing held in memory can leak into the restart.
    await cleanup();
    const file = h.mem.sqlite.export();
    h.mem.sqlite.close();

    // Relaunch 40 minutes later: open that file from scratch, run migrations as
    // app start does, build a new repository and render the app again.
    const relaunched = await createHarness(NOW + 40 * MIN, file);
    expect(relaunched.repo).not.toBe(h.repo);
    await renderApp(relaunched.repo);

    expect(card().getByText('Sleeping since 12:00')).toBeOnTheScreen();
    expect(card().getByRole('timer')).toHaveTextContent('40m');

    // And it can still be stopped after the restart.
    await fireEvent.press(card().getByRole('button', { name: 'Stop sleep' }));
    expect(sleeps(relaunched)).toEqual([
      expect.objectContaining({ occurredAt: NOW, endedAt: NOW + 40 * MIN }),
    ]);
    expect(screen.getByText('Sleep in the last 24h: 40m')).toBeOnTheScreen();
  });
});

async function jestAdvance(ms: number) {
  await act(async () => {
    jest.advanceTimersByTime(ms);
  });
}
