import type { ScheduledReminder } from '../activities';
import { reconcile, type PlacedReminder } from './reconcile';

const AT = Date.UTC(2026, 9, 28, 14, 0);
const HOUR = 3_600_000;

const want = (
  id: string,
  at: number,
  extra: Partial<ScheduledReminder> = {},
): ScheduledReminder => ({
  id,
  category: 'feed',
  at,
  bodyKey: 'reminders.feed.first',
  ...extra,
});
const placed = (handle: string, r: ScheduledReminder): PlacedReminder => ({
  handle,
  id: r.id,
  category: r.category,
  at: r.at,
  bodyKey: r.bodyKey,
  ...(r.values ? { values: r.values } : {}),
});

describe('keeping the phone holding exactly the right reminders', () => {
  it('schedules everything when the phone holds nothing', () => {
    const first = want('feed:first', AT);
    expect(reconcile([], [first])).toEqual({ cancel: [], schedule: [first] });
  });

  it('leaves an unchanged reminder alone: no cancel, no reschedule', () => {
    const first = want('feed:first', AT);
    expect(reconcile([placed('os-1', first)], [first])).toEqual({ cancel: [], schedule: [] });
  });

  it('moves one whose time changed, which is what relogging a feed does', () => {
    const before = want('feed:first', AT);
    const after = want('feed:first', AT + HOUR);
    expect(reconcile([placed('os-1', before)], [after])).toEqual({
      cancel: ['os-1'],
      schedule: [after],
    });
  });

  it('replaces one whose words changed, even at the same minute', () => {
    const before = want('feed:second', AT, { values: { time: '02:30' } });
    const after = want('feed:second', AT, { values: { time: '03:30' } });
    expect(reconcile([placed('os-1', before)], [after])).toEqual({
      cancel: ['os-1'],
      schedule: [after],
    });
  });

  it('cancels everything when reminders are turned off', () => {
    const held = [
      placed('os-1', want('feed:first', AT)),
      placed('os-2', want('feed:second', AT + HOUR)),
    ];
    expect(reconcile(held, [])).toEqual({ cancel: ['os-1', 'os-2'], schedule: [] });
  });

  it('cancels a leftover the new list no longer has', () => {
    const first = want('feed:first', AT);
    const second = want('feed:second', AT + HOUR);
    expect(reconcile([placed('os-1', first), placed('os-2', second)], [first])).toEqual({
      cancel: ['os-2'],
      schedule: [],
    });
  });

  it('clears a duplicate the phone somehow ended up holding', () => {
    // Two copies of the same reminder: one is kept, the other goes, so a
    // caregiver is buzzed once.
    const first = want('feed:first', AT);
    const out = reconcile([placed('os-1', first), placed('os-2', first)], [first]);
    expect(out.schedule).toEqual([]);
    expect(out.cancel).toEqual(['os-2']);
  });

  it('schedules in time order, so the nearer one is placed first', () => {
    const first = want('feed:first', AT);
    const second = want('feed:second', AT + HOUR);
    expect(reconcile([], [second, first]).schedule).toEqual([first, second]);
  });

  it('leaves another kind of notification alone', () => {
    // Nothing else schedules anything yet, but the day something does, a feed
    // reminder changing must not cancel it.
    const other = {
      ...placed('os-9', want('appointment:1', AT)),
      category: 'appointment' as const,
    };
    const first = want('feed:first', AT);
    const out = reconcile([other as unknown as PlacedReminder], [first]);
    expect(out.cancel).toEqual([]);
    expect(out.schedule).toEqual([first]);
  });
});
