import type { HomeState } from '../home/homeState';

/**
 * The minimal, serializable state a Live Activity (P5-01) or home-screen
 * widget (P5-02) needs to show "time since last feed" on the lock screen or
 * home screen without the app running. Native code renders the elapsed time
 * itself — from `lastFeedAt` and its own clock — so this keeps ticking
 * correctly after the app is backgrounded, rather than freezing at whatever
 * string was true the moment it was last sent across the bridge.
 */
export type LiveActivityPayload = {
  /** UTC epoch ms of the last feed, or null if none has been logged yet. */
  lastFeedAt: number | null;
};

/**
 * Derives the payload from the same `HomeState` the home screen already
 * shows (SDD 6.1) — one source for "when was the last feed", not a second
 * calculation that could drift from it (CLAUDE.md rule 4: never store a
 * derived value, compute it).
 */
export function selectLiveActivityPayload(home: HomeState): LiveActivityPayload {
  return { lastFeedAt: home.lastFeed?.occurredAt ?? null };
}
