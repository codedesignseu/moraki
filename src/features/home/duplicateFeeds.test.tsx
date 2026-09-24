import { fireEvent, screen, waitFor, within } from 'expo-router/testing-library';

import type { DevicePrefsRepository } from '@/db/repositories/devicePrefs';
import type { EventsRepository } from '@/db/repositories/events';
import { createHarness, renderApp } from '@/testing/appHarness';

jest.mock('@/ui/deviceTimeZone', () => ({ deviceTimeZone: () => 'Europe/Nicosia' }));

const MIN = 60_000;
const NOW = Date.parse('2026-10-28T12:00:00Z');

let repo: EventsRepository;
let prefs: DevicePrefsRepository;

beforeEach(async () => {
  ({ repo, prefs } = await createHarness(NOW));
});
afterEach(() => {
  jest.useRealTimers();
});

/** A feed the other phone logged, as a pull would have stored it. */
function theirFeed(at: number) {
  const mine = repo.insert({
    type: 'feed_bottle',
    occurredAt: at,
    payload: { ml: 90, milk: 'formula' },
  });
  // Re-author it: the repository stamps this phone's user on what it writes.
  repo.applyFromServer([
    {
      id: `theirs-${at}`,
      householdId: mine.householdId,
      babyId: mine.babyId,
      type: 'feed_bottle',
      occurredAt: at,
      endedAt: null,
      payload: { ml: 90, milk: 'formula' },
      groupId: null,
      createdBy: '0190a0b0-0000-7000-8000-00000000000b',
      updatedBy: '0190a0b0-0000-7000-8000-00000000000b',
      clientCreatedAt: at,
      serverUpdatedAt: at,
      seq: 1,
      deletedAt: null,
    },
  ]);
  repo.softDelete(mine.id);
  return `theirs-${at}`;
}

const banner = async () => within(await screen.findByTestId('home-duplicate'));

describe('the same feed logged twice', () => {
  it('asks, naming who else logged one and when', async () => {
    const mine = repo.insert({
      type: 'feed_bottle',
      occurredAt: NOW,
      payload: { ml: 90, milk: 'formula' },
    });
    theirFeed(NOW + 3 * MIN);

    await renderApp(repo);

    expect(
      (await banner()).getByText(/also logged a feed at 14:03\. Same feed\?/),
    ).toBeOnTheScreen();
    expect(repo.get(mine.id)?.deletedAt).toBe(null);
  });

  it('removes my own entry when I say it was the same feed', async () => {
    const mine = repo.insert({
      type: 'feed_bottle',
      occurredAt: NOW,
      payload: { ml: 90, milk: 'formula' },
    });
    const theirs = theirFeed(NOW + 3 * MIN);
    await renderApp(repo);

    await fireEvent.press((await banner()).getByRole('button', { name: 'Remove mine' }));

    // Mine goes; theirs is untouched — deleting their record isn't mine to do.
    await waitFor(() => expect(repo.get(mine.id)?.deletedAt).not.toBe(null));
    expect(repo.get(theirs)?.deletedAt).toBe(null);
    await waitFor(() => expect(screen.queryByTestId('home-duplicate')).toBeNull());
  });

  it('stops asking once I say they were two feeds', async () => {
    const mine = repo.insert({
      type: 'feed_bottle',
      occurredAt: NOW,
      payload: { ml: 90, milk: 'formula' },
    });
    theirFeed(NOW + 3 * MIN);
    await renderApp(repo);

    await fireEvent.press((await banner()).getByRole('button', { name: 'Keep both' }));

    await waitFor(() => expect(screen.queryByTestId('home-duplicate')).toBeNull());
    // Both entries stay, and the answer is remembered rather than asked again.
    expect(repo.get(mine.id)?.deletedAt).toBe(null);
    expect(prefs.get('keptDuplicates')).toContain(mine.id);
  });

  it('asks nothing when the other feed is well clear of mine', async () => {
    repo.insert({ type: 'feed_bottle', occurredAt: NOW, payload: { ml: 90, milk: 'formula' } });
    theirFeed(NOW + 30 * MIN);

    await renderApp(repo);

    await screen.findByTestId('home-recent');
    expect(screen.queryByTestId('home-duplicate')).toBeNull();
  });

  it('asks nothing about my own two feeds', async () => {
    repo.insert({ type: 'feed_bottle', occurredAt: NOW, payload: { ml: 90, milk: 'formula' } });
    repo.insert({
      type: 'feed_bottle',
      occurredAt: NOW + MIN,
      payload: { ml: 60, milk: 'formula' },
    });

    await renderApp(repo);

    await screen.findByTestId('home-recent');
    expect(screen.queryByTestId('home-duplicate')).toBeNull();
  });
});
