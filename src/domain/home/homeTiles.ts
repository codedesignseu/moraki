import { getActivity, HOME_TILES, isSleep, type Event, type HomeTile } from '../activities';
import { dayBucket } from '../time/zoned';

/**
 * The detail line under a Home tile (direction G, decision G2):
 * - `none`: nothing of this kind yet ("Not yet").
 * - `last`: when the latest one happened ("Last 21:40", "Last yesterday").
 * - `running`: a sleep is running now ("Sleeping").
 * - `awake`: how long since the last sleep ended ("Awake 1 h 05").
 */
export type TileStatus =
  | { kind: 'none' }
  | { kind: 'last'; at: number; daysAgo: number }
  | { kind: 'running' }
  | { kind: 'awake'; sinceMs: number };

export type HomeTiles = Record<HomeTile, TileStatus>;

/**
 * What each Home tile says under its name. Pure and derived, never stored
 * (rule 4): the events, `now` (UTC epoch ms) and the device timezone in, the
 * statuses out. A module joins a tile through its `quickAction`, so no tile
 * names an event type.
 *
 * A tile that holds sleeps reads as a sleep: running while one is open, then
 * the time awake since the latest one ended. Every other tile gives the time
 * of its latest entry by when it happened.
 */
export function selectHomeTiles(
  events: readonly Event<unknown>[],
  now: number,
  tz: string,
): HomeTiles {
  const live = events.filter((e) => e.deletedAt === null);
  const status = (tile: HomeTile): TileStatus => {
    const mine = live.filter((e) => getActivity(e.type)?.quickAction?.tile === tile);
    const sleeps = mine.filter(isSleep);
    if (sleeps.some((e) => e.endedAt === null)) return { kind: 'running' };
    const ends = sleeps.map((e) => e.endedAt ?? 0);
    if (ends.length > 0) return { kind: 'awake', sinceMs: Math.max(0, now - Math.max(...ends)) };
    if (mine.length === 0) return { kind: 'none' };
    const at = Math.max(...mine.map((e) => e.occurredAt));
    return { kind: 'last', at, daysAgo: dayBucket(at, now, tz).daysAgo };
  };
  return Object.fromEntries(HOME_TILES.map((tile) => [tile, status(tile)])) as HomeTiles;
}
