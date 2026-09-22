import type { EventsRepository } from '@/db/repositories/events';
import type { Settings } from '@/domain/activities';
import { computeFeedReminders } from '@/domain/reminders/feedReminders';

import { createHarness } from './appHarness';

// The P1-13 done-when, driven through the real repository: the reminders are
// recomputed from what the database now holds after each write.
const MIN = 60_000;
const HOUR = 60 * MIN;
const NOW = Date.parse('2026-07-01T09:00:00Z');
const SETTINGS: Settings = { enabled: true, intervalMin: 180, secondReminderMin: 30 };

let repo: EventsRepository;
beforeEach(async () => {
  ({ repo } = await createHarness(NOW));
});
afterEach(() => {
  jest.useRealTimers();
});

const times = () =>
  computeFeedReminders(repo.list(), SETTINGS, Date.now(), 'Europe/Nicosia').map((r) => [
    r.id,
    r.at,
  ]);
const feed = (at: number) =>
  repo.insert({ type: 'feed_bottle', occurredAt: at, payload: { ml: 90, milk: 'formula' } });

describe('reminders recompute from the database after each write (P1-13)', () => {
  it('moves on a new feed, on an edit of the last feed, and falls back on its delete', () => {
    const first = feed(NOW - 2 * HOUR);
    expect(times()).toEqual([
      ['feed:first', first.occurredAt + 3 * HOUR],
      ['feed:second', first.occurredAt + 3.5 * HOUR],
    ]);

    const last = feed(NOW - 20 * MIN);
    expect(times()).toEqual([
      ['feed:first', last.occurredAt + 3 * HOUR],
      ['feed:second', last.occurredAt + 3.5 * HOUR],
    ]);

    repo.patch(last.id, { occurredAt: last.occurredAt - 10 * MIN });
    expect(times()).toEqual([
      ['feed:first', last.occurredAt - 10 * MIN + 3 * HOUR],
      ['feed:second', last.occurredAt - 10 * MIN + 3.5 * HOUR],
    ]);

    repo.softDelete(last.id);
    expect(times()).toEqual([
      ['feed:first', first.occurredAt + 3 * HOUR],
      ['feed:second', first.occurredAt + 3.5 * HOUR],
    ]);
  });
});
