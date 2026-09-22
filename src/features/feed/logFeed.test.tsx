import { fireEvent, screen, within } from 'expo-router/testing-library';

import type { EventsRepository } from '@/db/repositories/events';
import type { Event } from '@/domain/activities';
import { selectHomeState } from '@/domain/home/homeState';
import { createHarness, renderApp as renderRoutes } from '@/testing/appHarness';

jest.mock('@/ui/deviceTimeZone', () => ({ deviceTimeZone: () => 'Europe/Nicosia' }));

const MIN = 60_000;
const HOUR = 60 * MIN;
const NOW = Date.parse('2026-07-01T09:00:00Z');

let repo: EventsRepository;

beforeEach(async () => {
  ({ repo } = await createHarness(NOW));
});

afterEach(() => {
  jest.useRealTimers();
});

const renderApp = () => renderRoutes(repo);

/** Home, then tap Log feed: the sheet as a caregiver reaches it. */
async function openSheet() {
  await renderApp();
  await fireEvent.press(screen.getByRole('button', { name: 'Log feed' }));
}

const feeds = () =>
  repo.list().filter((e) => e.type === 'feed_bottle' || e.type === 'feed_breast') as Event<
    Record<string, unknown>
  >[];

describe('logging a feed', () => {
  it('logs a repeat bottle feed in 2 taps from home: Log feed, then Save', async () => {
    repo.insert({
      type: 'feed_bottle',
      occurredAt: NOW - 3 * HOUR,
      payload: { ml: 120, milk: 'breast' },
    });
    await renderApp();

    await fireEvent.press(screen.getByRole('button', { name: 'Log feed' })); // tap 1
    expect(screen.getByRole('button', { name: 'Save' })).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Save' })); // tap 2

    const [latest] = feeds();
    expect(latest).toMatchObject({
      type: 'feed_bottle',
      occurredAt: NOW,
      payload: { ml: 120, milk: 'breast' },
    });
    expect(feeds()).toHaveLength(2);
    // Back on home, which shows the new feed straight away.
    expect(screen.queryByRole('button', { name: 'Save' })).toBeNull();
    expect(screen.getByLabelText('Feeds: 2')).toBeOnTheScreen();
    expect(screen.getByRole('timer')).toHaveTextContent('0m');
  });

  it('logs the very first feed in 2 taps with the first-feed defaults', async () => {
    await renderApp();
    await fireEvent.press(screen.getByRole('button', { name: 'Log feed' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    expect(feeds()[0]).toMatchObject({ type: 'feed_bottle', payload: { ml: 90, milk: 'formula' } });
  });

  it('opens with the current time', async () => {
    await openSheet();
    expect(screen.getByText('At 12:00')).toBeOnTheScreen();
  });

  it('logs a breast feed on the suggested side', async () => {
    repo.insert({ type: 'feed_breast', occurredAt: NOW - 2 * HOUR, payload: { side: 'left' } });
    await openSheet();
    const side = within(screen.getByLabelText('Side'));
    expect(side.getByRole('radio', { name: 'Right' })).toBeChecked();
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    expect(feeds()[0]).toMatchObject({ type: 'feed_breast', payload: { side: 'right' } });
  });

  it('logs a mixed feed as a bottle and a breast event sharing a group', async () => {
    await openSheet();
    await fireEvent.press(screen.getByRole('radio', { name: 'Both' }));
    await fireEvent.press(
      within(screen.getByLabelText('Side')).getByRole('radio', { name: 'Left' }),
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    const [a, b] = feeds();
    expect(new Set([a?.type, b?.type])).toEqual(new Set(['feed_bottle', 'feed_breast']));
    expect(a?.groupId).toBeTruthy();
    expect(b?.groupId).toBe(a?.groupId);
  });

  it('saves a changed amount and milk type', async () => {
    await openSheet();
    await fireEvent(screen.getByLabelText('Amount'), 'accessibilityAction', {
      nativeEvent: { actionName: 'increment' },
    });
    await fireEvent.press(
      within(screen.getByLabelText('Milk')).getByRole('radio', { name: 'Breast milk' }),
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    expect(feeds()[0]).toMatchObject({ payload: { ml: 100, milk: 'breast' } });
  });

  describe('breastfeed duration (P1-19)', () => {
    const today = () =>
      selectHomeState(repo.list(), Date.now(), 'Europe/Nicosia', {
        reminderIntervalMin: 180,
        secondReminderMin: null,
      }).today;
    const choose = async (group: string, option: string) =>
      fireEvent.press(within(screen.getByLabelText(group)).getByRole('radio', { name: option }));
    const step = async (label: string, actionName: 'increment' | 'decrement') =>
      fireEvent(screen.getByLabelText(label), 'accessibilityAction', {
        nativeEvent: { actionName },
      });

    it('saves a breastfeed as ending now and starting "Fed for" minutes ago', async () => {
      await openSheet();
      await choose('Feed type', 'Breast');
      expect(screen.getByLabelText('Fed for')).toHaveAccessibilityValue({ now: 15 });
      // The sheet shows the times it will save: 11:45 to 12:00 local.
      expect(screen.getByText('11:45 to 12:00')).toBeOnTheScreen();
      await step('Fed for', 'increment');
      expect(screen.getByText('11:40 to 12:00')).toBeOnTheScreen();
      await step('Fed for', 'decrement');
      await fireEvent.press(screen.getByRole('button', { name: 'Save' }));

      expect(feeds()[0]).toMatchObject({
        type: 'feed_breast',
        occurredAt: NOW - 15 * MIN,
        endedAt: NOW,
      });
      expect(today()).toMatchObject({ feeds: 1, ml: 0, breastMs: 15 * MIN });
      // "Since last feed" counts from when the feed started.
      expect(screen.getByRole('timer')).toHaveTextContent('15m');
    });

    it('saves a changed duration', async () => {
      await openSheet();
      await choose('Feed type', 'Breast');
      await step('Fed for', 'increment');
      await step('Fed for', 'increment');
      await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
      expect(today().breastMs).toBe(25 * MIN);
    });

    it('starts both parts of a mixed feed when the session started, adding mL and minutes separately', async () => {
      await openSheet();
      await choose('Feed type', 'Both');
      await step('Fed for', 'decrement');
      await fireEvent.press(screen.getByRole('button', { name: 'Save' }));

      const [a, b] = feeds();
      expect(a?.occurredAt).toBe(NOW - 10 * MIN);
      expect(b?.occurredAt).toBe(NOW - 10 * MIN);
      expect(feeds().find((e) => e.type === 'feed_breast')?.endedAt).toBe(NOW);
      expect(feeds().find((e) => e.type === 'feed_bottle')?.endedAt).toBeNull();
      expect(today()).toMatchObject({ feeds: 1, ml: 90, breastMs: 10 * MIN });
    });

    it('opens with the last breastfeed duration', async () => {
      repo.insert({
        type: 'feed_breast',
        occurredAt: NOW - 3 * HOUR,
        endedAt: NOW - 3 * HOUR + 20 * MIN,
        payload: { side: 'left' },
      });
      await openSheet();
      expect(screen.getByLabelText('Fed for')).toHaveAccessibilityValue({ now: 20 });
    });

    it('does not show the duration for a bottle-only feed, which still saves at the time the sheet opened', async () => {
      await openSheet();
      expect(screen.queryByLabelText('Fed for')).toBeNull();
      await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
      expect(feeds()[0]).toMatchObject({ type: 'feed_bottle', occurredAt: NOW, endedAt: null });
    });
  });
});
