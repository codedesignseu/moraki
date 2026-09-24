import type { Event, EventType } from '../activities';
import { findDuplicateFeeds } from './duplicateFeeds';

const MIN = 60_000;
const NOW = Date.UTC(2026, 9, 28, 12, 0);
const ME = 'maria';
const THEM = 'nikos';
const NAMES = new Map([[THEM, 'Nik']]);
const OTHER = 'Another caregiver';

let n = 0;
function ev<P>(type: EventType, occurredAt: number, payload: P, extra: Partial<Event<P>> = {}) {
  n += 1;
  return {
    id: `e${n}`,
    householdId: 'h',
    babyId: 'b',
    type,
    occurredAt,
    endedAt: null,
    payload,
    groupId: null,
    createdBy: ME,
    updatedBy: ME,
    clientCreatedAt: occurredAt,
    deletedAt: null,
    ...extra,
  } satisfies Event<P>;
}
const myBottle = (at: number, extra = {}) =>
  ev('feed_bottle', at, { ml: 90, milk: 'formula' }, extra);
const theirBottle = (at: number, extra = {}) =>
  ev(
    'feed_bottle',
    at,
    { ml: 90, milk: 'formula' },
    { createdBy: THEM, updatedBy: THEM, ...extra },
  );
const theirBreast = (at: number) =>
  ev('feed_breast', at, { side: 'left' }, { createdBy: THEM, updatedBy: THEM });

const find = (events: Event<unknown>[]) => findDuplicateFeeds(events, ME, NAMES, OTHER);

describe('the same feed logged twice', () => {
  it('asks when the other caregiver logged one within five minutes', () => {
    const mine = myBottle(NOW);
    const theirs = theirBottle(NOW + 3 * MIN);

    const found = find([mine, theirs]);
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ mine: { id: mine.id }, theirs: { id: theirs.id }, by: 'Nik' });
  });

  it('asks whichever way round the two were logged', () => {
    expect(find([myBottle(NOW), theirBottle(NOW - 4 * MIN)])).toHaveLength(1);
  });

  it('says nothing about feeds further apart than five minutes', () => {
    expect(find([myBottle(NOW), theirBottle(NOW + 6 * MIN)])).toEqual([]);
  });

  it('says nothing when both are mine: two phones, one person, is still me', () => {
    expect(find([myBottle(NOW), myBottle(NOW + MIN)])).toEqual([]);
  });

  it('never matches a bottle with a breastfeed', () => {
    expect(find([myBottle(NOW), theirBreast(NOW + MIN)])).toEqual([]);
  });

  it('never matches a mixed feed’s own two halves', () => {
    // One session, logged as a bottle and a breastfeed by the same person:
    // both are mine, and the pairing only looks across to another caregiver.
    const bottle = ev('feed_bottle', NOW, { ml: 60, milk: 'breast' }, { groupId: 'g1' });
    const breast = ev('feed_breast', NOW, { side: 'left' }, { groupId: 'g1' });
    expect(find([bottle, breast])).toEqual([]);
  });

  it('forgets a feed that has been deleted', () => {
    const mine = myBottle(NOW);
    expect(find([mine, theirBottle(NOW + MIN, { deletedAt: NOW })])).toEqual([]);
    expect(find([{ ...mine, deletedAt: NOW }, theirBottle(NOW + MIN)])).toEqual([]);
  });

  it('falls back to a plain word when this phone has no name for them', () => {
    const found = findDuplicateFeeds([myBottle(NOW), theirBottle(NOW + MIN)], ME, new Map(), OTHER);
    expect(found[0]?.by).toBe(OTHER);
  });

  it('offers only my own entry, never theirs', () => {
    const found = find([myBottle(NOW), theirBottle(NOW + MIN)]);
    expect(found[0]?.mine.createdBy).toBe(ME);
    expect(found[0]?.theirs.createdBy).toBe(THEM);
  });

  it('puts the most recent question first', () => {
    const older = myBottle(NOW - 60 * MIN);
    const newer = myBottle(NOW);
    const found = find([older, newer, theirBottle(NOW - 59 * MIN), theirBottle(NOW + MIN)]);
    expect(found.map((pair) => pair.mine.id)).toEqual([newer.id, older.id]);
  });

  it('asks nothing when a household has only one caregiver', () => {
    expect(find([myBottle(NOW), myBottle(NOW + 2 * MIN), myBottle(NOW + 4 * MIN)])).toEqual([]);
  });
});
