import type { Event } from './contract';
import type { FeedBottlePayload } from './feedBottle';
import type { FeedBreastPayload } from './feedBreast';
import { breastDurationMs } from './feedBreast';
import { isBreastFeed, isFeed } from './queries';

export type FeedKind = 'bottle' | 'breast' | 'mixed';

export type FeedPrefill = {
  kind: FeedKind;
  ml: number;
  milk: FeedBottlePayload['milk'];
  side: FeedBreastPayload['side'];
  /** How long the breastfeed lasted, in minutes (P1-19). */
  breastMinutes: number;
  /** Where the bottle was poured from, or null when it wasn't from a store (P3-02). */
  fromStock: NonNullable<FeedBottlePayload['from_stock']> | null;
};

/** The feed sheet's "Fed for" stepper (P1-19). */
export const BREAST_MINUTES = { step: 5, min: 5, max: 90 } as const;

/** Used only before the first bottle or breast feed is ever logged. */
export const FIRST_FEED_DEFAULTS = {
  ml: 90,
  milk: 'formula',
  side: 'left',
  breastMinutes: 15,
  fromStock: null,
} as const;

const MINUTE_MS = 60_000;

/** A recorded duration as a stepper value: nearest step, within the stepper's range. */
function toStepperMinutes(ms: number): number {
  const { step, min, max } = BREAST_MINUTES;
  return Math.min(max, Math.max(min, Math.round(ms / MINUTE_MS / step) * step));
}

const latest = <E extends Event<unknown>>(events: E[]): E | undefined =>
  events.reduce<E | undefined>(
    (best, e) => (!best || e.occurredAt > best.occurredAt ? e : best),
    undefined,
  );

/**
 * What the feed sheet opens with (SDD 7): the kind of the last feed, the last
 * bottle's amount and milk type, the suggested next breast side and the last
 * breastfeed's duration (entries saved without one fall back to the default). Derived
 * from events each time, never stored (rule 4).
 */
export function feedPrefill(
  events: readonly Event<unknown>[],
  nextSide: 'left' | 'right' | null,
): FeedPrefill {
  const feeds = events.filter((e) => e.deletedAt === null).filter(isFeed);
  const last = latest(feeds);
  const partnered =
    last?.groupId != null && feeds.some((e) => e.groupId === last.groupId && e.type !== last.type);
  const kind: FeedKind =
    last === undefined ? 'bottle' : partnered ? 'mixed' : isBreastFeed(last) ? 'breast' : 'bottle';

  const lastBottle = latest(feeds.filter((e): e is Event<FeedBottlePayload> => !isBreastFeed(e)));
  const lastBreast = latest(feeds.filter(isBreastFeed));

  return {
    kind,
    ml: lastBottle?.payload.ml ?? FIRST_FEED_DEFAULTS.ml,
    milk: lastBottle?.payload.milk ?? FIRST_FEED_DEFAULTS.milk,
    side: nextSide ?? lastBreast?.payload.side ?? FIRST_FEED_DEFAULTS.side,
    breastMinutes:
      lastBreast && breastDurationMs(lastBreast) > 0
        ? toStepperMinutes(breastDurationMs(lastBreast))
        : FIRST_FEED_DEFAULTS.breastMinutes,
    // Expressed milk usually comes from the same place as last time; formula
    // never comes from one, so the option resets with the milk type.
    fromStock: lastBottle?.payload.from_stock ?? FIRST_FEED_DEFAULTS.fromStock,
  };
}

/** A logged feed (one event, or a mixed feed's two) as the feed sheet edits it (P1-12). */
export type FeedEditTarget = {
  form: FeedPrefill;
  /** When the feed started: the earliest of its parts. */
  start: number;
  bottle: Event<FeedBottlePayload> | null;
  breast: Event<FeedBreastPayload> | null;
};

/** Reads a feed's live parts back into the sheet's form, or null if it has none. */
export function feedEditTarget(parts: readonly Event<unknown>[]): FeedEditTarget | null {
  const live = parts.filter((e) => e.deletedAt === null).filter(isFeed);
  const bottle = live.find((e): e is Event<FeedBottlePayload> => !isBreastFeed(e)) ?? null;
  const breast = live.find(isBreastFeed) ?? null;
  if (!bottle && !breast) return null;
  const duration = breast ? breastDurationMs(breast) : 0;
  return {
    form: {
      kind: bottle && breast ? 'mixed' : breast ? 'breast' : 'bottle',
      ml: bottle?.payload.ml ?? FIRST_FEED_DEFAULTS.ml,
      milk: bottle?.payload.milk ?? FIRST_FEED_DEFAULTS.milk,
      side: breast?.payload.side ?? FIRST_FEED_DEFAULTS.side,
      breastMinutes: duration > 0 ? toStepperMinutes(duration) : FIRST_FEED_DEFAULTS.breastMinutes,
      fromStock: bottle?.payload.from_stock ?? FIRST_FEED_DEFAULTS.fromStock,
    },
    start: Math.min(...live.map((e) => e.occurredAt)),
    bottle,
    breast,
  };
}
