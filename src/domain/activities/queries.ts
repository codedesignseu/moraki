import type { Event } from './contract';
import type { FeedBottlePayload } from './feedBottle';
import type { FeedBreastPayload } from './feedBreast';
import type { MedicationPayload } from './medication';
import type { SleepPayload } from './sleep';

// Type checks live here so nothing outside domain/activities branches on
// event type (SDD 15.2).

export type FeedEvent = Event<FeedBottlePayload> | Event<FeedBreastPayload>;

export function isFeed(e: Event<unknown>): e is FeedEvent {
  return e.type === 'feed_bottle' || e.type === 'feed_breast';
}

export function isBreastFeed(e: Event<unknown>): e is Event<FeedBreastPayload> {
  return e.type === 'feed_breast';
}

export function isSleep(e: Event<unknown>): e is Event<SleepPayload> {
  return e.type === 'sleep';
}

export function isMedication(e: Event<unknown>): e is Event<MedicationPayload> {
  return e.type === 'medication';
}

/** The latest live medication entry, for prefilling the next one. */
export function lastMedication(events: readonly Event<unknown>[]): MedicationPayload | null {
  const meds = events.filter((e) => e.deletedAt === null).filter(isMedication);
  const last = meds.reduce<Event<MedicationPayload> | null>(
    (best, e) => (best === null || e.occurredAt > best.occurredAt ? e : best),
    null,
  );
  return last?.payload ?? null;
}

/** The latest live bottle or breast feed by when it happened (SDD 6.1), or null. */
export function latestFeed(events: readonly Event<unknown>[]): FeedEvent | null {
  return events
    .filter((e) => e.deletedAt === null)
    .filter(isFeed)
    .reduce<FeedEvent | null>(
      (best, e) => (best === null || e.occurredAt > best.occurredAt ? e : best),
      null,
    );
}
