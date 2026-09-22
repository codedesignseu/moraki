import type { Event } from './contract';
import type { FeedBottlePayload } from './feedBottle';
import type { FeedBreastPayload } from './feedBreast';
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
