import { isBreastFeed, isFeed, type Event, type FeedEvent } from '../activities';

/** How close two feeds must be to be worth asking about (SDD 5.6). */
export const DUPLICATE_WINDOW_MS = 5 * 60_000;

export type DuplicatePair = {
  /** The entry this phone logged. Removing it is the offer. */
  mine: FeedEvent;
  /** The other caregiver's, which arrived by sync. */
  theirs: FeedEvent;
  /** Who logged theirs, for the question. */
  by: string;
};

const kind = (e: FeedEvent) => (isBreastFeed(e) ? 'breast' : 'bottle');

/**
 * Feeds that look like the same feed logged twice (SDD 5.6): one of mine and
 * one of another caregiver's, of the same kind, within five minutes.
 *
 * It never merges anything. Two caregivers can genuinely feed a baby twice in
 * five minutes — topping up after a breastfeed is ordinary — so this only
 * asks, and the answer belongs to whoever is holding the baby.
 *
 * Only my own entry is ever offered for removal: deleting someone else's
 * record of what they did is not mine to offer.
 *
 * A mixed feed needs no special case: its two events are written together by
 * one phone, so they are both mine or both theirs, and the pairing only ever
 * looks across that line.
 */
export function findDuplicateFeeds(
  events: readonly Event<unknown>[],
  me: string,
  names: ReadonlyMap<string, string>,
  otherName: string,
): DuplicatePair[] {
  const feeds = events.filter((e) => e.deletedAt === null).filter(isFeed);
  const mine = feeds.filter((e) => e.createdBy === me);
  const theirs = feeds.filter((e) => e.createdBy !== me);

  return mine
    .flatMap((ours) => {
      const match = theirs.find(
        (other) =>
          kind(other) === kind(ours) &&
          Math.abs(other.occurredAt - ours.occurredAt) <= DUPLICATE_WINDOW_MS,
      );
      return match
        ? [{ mine: ours, theirs: match, by: names.get(match.createdBy) ?? otherName }]
        : [];
    })
    .sort((a, b) => b.mine.occurredAt - a.mine.occurredAt);
}
