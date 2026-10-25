import { isPurgedTombstone, PURGE_AFTER_MS, purgeDue, toTombstone } from './purge';

const NOW = Date.UTC(2026, 9, 24, 12, 0);
const DAY = 24 * 60 * 60 * 1000;
const deleted = (daysAgo: number | null, payload: unknown = { ml: 90, milk: 'formula' }) => ({
  occurredAt: NOW - 60 * DAY,
  endedAt: NOW - 60 * DAY + 600_000,
  payload,
  groupId: 'g1',
  deletedAt: daysAgo === null ? null : NOW - daysAgo * DAY,
});

describe('purging deleted entries (P0.6)', () => {
  it('keeps content for 30 days, the same as the server', () => {
    expect(PURGE_AFTER_MS).toBe(30 * DAY);
  });

  it('is due only for an entry deleted more than 30 days ago that still has content', () => {
    expect(purgeDue(deleted(31), NOW)).toBe(true);
    expect(purgeDue(deleted(29), NOW)).toBe(false);
    expect(purgeDue(deleted(30), NOW)).toBe(false); // exactly 30 days: not yet
    expect(purgeDue(deleted(null), NOW)).toBe(false); // a live entry never
    expect(purgeDue(deleted(31, {}), NOW)).toBe(false); // already empty
  });

  it('tells an empty tombstone from a live entry with an empty payload', () => {
    expect(isPurgedTombstone(deleted(31, {}))).toBe(true);
    expect(isPurgedTombstone(deleted(null, {}))).toBe(false);
    expect(isPurgedTombstone(deleted(31))).toBe(false);
    expect(isPurgedTombstone(deleted(31, null))).toBe(false);
  });

  it('leaves the shape the server leaves: no content, no end, no group, the delete time', () => {
    const before = { ...deleted(31), deletedAt: NOW - 31 * DAY, id: 'e1', type: 'feed_bottle' };
    expect(toTombstone(before)).toEqual({
      id: 'e1',
      type: 'feed_bottle',
      payload: {},
      endedAt: null,
      groupId: null,
      occurredAt: NOW - 31 * DAY,
      deletedAt: NOW - 31 * DAY,
    });
  });
});
