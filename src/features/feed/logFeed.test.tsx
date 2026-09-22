import { Stack } from 'expo-router';
import { fireEvent, renderRouter, screen, within } from 'expo-router/testing-library';
import { randomBytes } from 'node:crypto';

import LogFeed from '../../../app/log/feed';
import Home from '../../../app/index';
import { EventsRepositoryProvider } from '@/db/react';
import { createEventsRepository, type EventsRepository } from '@/db/repositories/events';
import { createMemoryDb } from '@/db/testing/memoryDb';
import type { Event } from '@/domain/activities';
import { newId } from '@/domain/ids';
import '@/i18n';
import { ThemeProvider } from '@/ui/theme';

jest.mock('@/ui/deviceTimeZone', () => ({ deviceTimeZone: () => 'Europe/Nicosia' }));

const MIN = 60_000;
const HOUR = 60 * MIN;
const NOW = Date.parse('2026-07-01T09:00:00Z');

let repo: EventsRepository;

beforeEach(async () => {
  jest.useRealTimers();
  const { db } = await createMemoryDb();
  jest.useFakeTimers({ now: NOW });
  repo = createEventsRepository(db, {
    now: Date.now,
    newId: (at) => newId(at, () => new Uint8Array(randomBytes(16))),
  });
});

afterEach(() => {
  jest.useRealTimers();
});

// The real app routes, with a test database in place of expo-sqlite.
function TestLayout() {
  return (
    <ThemeProvider scheme="light">
      <EventsRepositoryProvider repository={repo}>
        <Stack />
      </EventsRepositoryProvider>
    </ThemeProvider>
  );
}

const renderApp = () => renderRouter({ _layout: TestLayout, index: Home, 'log/feed': LogFeed });

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
});
