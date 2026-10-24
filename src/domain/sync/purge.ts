/**
 * Deleted entries keep their content for 30 days, then only an empty
 * tombstone is left (P0.6). The server purges its copy on a daily schedule
 * (supabase/migrations/20261024090000_purge_deleted_event_content.sql) and
 * every phone pulls the result; a phone also empties its own old tombstones,
 * so one that is offline, or never signed in, does not keep them either.
 *
 * The tombstone has the same shape on both sides: payload `{}`, no end time,
 * no group, and the delete time in place of when it happened.
 */

/** How long a deleted entry keeps its content. Matches deleted_content_retention(). */
export const PURGE_AFTER_MS = 30 * 24 * 60 * 60 * 1000;

type Purgeable = {
  occurredAt: number;
  endedAt: number | null;
  payload: unknown;
  groupId: string | null;
  deletedAt: number | null;
};

const isEmpty = (payload: unknown): boolean =>
  typeof payload === 'object' &&
  payload !== null &&
  !Array.isArray(payload) &&
  Object.keys(payload).length === 0;

/** A deleted entry with nothing left in it: what the purge leaves behind. */
export function isPurgedTombstone(event: Pick<Purgeable, 'deletedAt' | 'payload'>): boolean {
  return event.deletedAt !== null && isEmpty(event.payload);
}

/** True once a deleted entry has kept its content for the full 30 days. */
export function purgeDue(event: Pick<Purgeable, 'deletedAt' | 'payload'>, now: number): boolean {
  return (
    event.deletedAt !== null && event.deletedAt < now - PURGE_AFTER_MS && !isPurgedTombstone(event)
  );
}

/** The same deleted entry with its content gone. */
export function toTombstone<T extends Purgeable>(event: T & { deletedAt: number }): T {
  return {
    ...event,
    payload: {},
    endedAt: null,
    groupId: null,
    occurredAt: event.deletedAt,
  };
}
