import type { Event, EventType } from '../activities';
import { DEFAULT_HOME_SETTINGS, selectHomeState } from '../home/homeState';
import { selectLiveActivityPayload } from './liveActivityPayload';

const TZ = 'Europe/Nicosia';
const HOUR = 3_600_000;
const NOW = Date.parse('2026-10-25T10:00:00Z');

let seq = 0;
function ev<P>(type: EventType, occurredAt: number, payload: P): Event<P> {
  seq += 1;
  return {
    id: `e${seq}`,
    householdId: 'h',
    babyId: 'b',
    type,
    occurredAt,
    endedAt: null,
    payload,
    groupId: null,
    createdBy: 'me',
    updatedBy: 'me',
    clientCreatedAt: occurredAt,
    deletedAt: null,
  };
}

describe('selectLiveActivityPayload', () => {
  it('carries the last feed time home already shows, not a second calculation of it', () => {
    const feedAt = NOW - 2 * HOUR;
    const home = selectHomeState(
      [ev('feed_bottle', feedAt, { ml: 90, milk: 'formula' })],
      NOW,
      TZ,
      DEFAULT_HOME_SETTINGS,
    );

    expect(selectLiveActivityPayload(home)).toEqual({ lastFeedAt: feedAt });
  });

  it('is null with nothing logged yet, not a made-up time', () => {
    const home = selectHomeState([], NOW, TZ, DEFAULT_HOME_SETTINGS);
    expect(selectLiveActivityPayload(home)).toEqual({ lastFeedAt: null });
  });
});
