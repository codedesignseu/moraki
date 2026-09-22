import type { Event, EventType } from './contract';
import { feedPrefill, FIRST_FEED_DEFAULTS } from './feedPrefill';

let n = 0;
function ev<P>(
  type: EventType,
  occurredAt: number,
  payload: P,
  extra: Partial<Event<P>> = {},
): Event<P> {
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
    createdBy: 'u',
    updatedBy: 'u',
    clientCreatedAt: occurredAt,
    deletedAt: null,
    ...extra,
  };
}

describe('feedPrefill', () => {
  it('uses first-feed defaults when nothing has been logged', () => {
    expect(feedPrefill([], null)).toEqual({ kind: 'bottle', ...FIRST_FEED_DEFAULTS });
  });

  it('repeats the last bottle amount and milk type', () => {
    const events = [
      ev('feed_bottle', 1, { ml: 60, milk: 'breast' }),
      ev('feed_bottle', 2, { ml: 120, milk: 'mixed' }),
    ];
    expect(feedPrefill(events, null)).toMatchObject({ kind: 'bottle', ml: 120, milk: 'mixed' });
  });

  it('opens on breast after a breast feed, keeping the last bottle amount', () => {
    const events = [
      ev('feed_bottle', 1, { ml: 70, milk: 'formula' }),
      ev('feed_breast', 2, { side: 'left' }),
    ];
    expect(feedPrefill(events, 'right')).toEqual({
      kind: 'breast',
      ml: 70,
      milk: 'formula',
      side: 'right',
    });
  });

  it('opens on mixed after a grouped bottle and breast feed', () => {
    const events = [
      ev('feed_breast', 5, { side: 'right' }, { groupId: 'g' }),
      ev('feed_bottle', 5, { ml: 30, milk: 'breast' }, { groupId: 'g' }),
    ];
    expect(feedPrefill(events, 'left')).toMatchObject({ kind: 'mixed', ml: 30, side: 'left' });
  });

  it('ignores deleted feeds', () => {
    const events = [
      ev('feed_bottle', 1, { ml: 80, milk: 'formula' }),
      ev('feed_bottle', 2, { ml: 200, milk: 'breast' }, { deletedAt: 3 }),
    ];
    expect(feedPrefill(events, null)).toMatchObject({ ml: 80, milk: 'formula' });
  });

  it('falls back to the last breast side when there is no suggestion', () => {
    expect(feedPrefill([ev('feed_breast', 1, { side: 'both' })], null).side).toBe('both');
  });
});
