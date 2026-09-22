import type { PulledEvent } from '@/domain/sync/pendingProtection';

import type { Auth } from './auth';

/** SDD 5.3 reads the household's events in pages of 500, by seq. */
export const PULL_PAGE = 500;

/** The request never reached the server, or the answer wasn't one. */
export class PullTransportError extends Error {
  override name = 'PullTransportError';
}

type ServerRow = {
  id: string;
  household_id: string;
  baby_id: string;
  type: string;
  occurred_at: string;
  ended_at: string | null;
  payload: Record<string, unknown> | null;
  group_id: string | null;
  created_by: string;
  updated_by: string;
  client_created_at: string;
  server_updated_at: string | null;
  deleted_at: string | null;
  seq: number;
};

/** Times are stored as epoch milliseconds on the phone (rule 5). */
const ms = (value: string | null): number | null => (value === null ? null : Date.parse(value));

function toPulled(row: ServerRow): PulledEvent {
  return {
    id: row.id,
    householdId: row.household_id,
    babyId: row.baby_id,
    type: row.type,
    occurredAt: ms(row.occurred_at) ?? 0,
    endedAt: ms(row.ended_at),
    payload: row.payload ?? {},
    groupId: row.group_id,
    createdBy: row.created_by,
    updatedBy: row.updated_by,
    clientCreatedAt: ms(row.client_created_at) ?? 0,
    serverUpdatedAt: ms(row.server_updated_at),
    seq: row.seq,
    deletedAt: ms(row.deleted_at),
  };
}

/**
 * One page of the household's events after `cursor`, oldest change first
 * (SDD 5.3). Deleted events come too: a delete is a change like any other,
 * and the phone has to learn about it.
 */
export async function pullPage(
  auth: Auth,
  householdId: string,
  cursor: number,
  limit: number = PULL_PAGE,
): Promise<PulledEvent[]> {
  const { data, error } = await auth.client
    .from('events')
    .select(
      'id, household_id, baby_id, type, occurred_at, ended_at, payload, group_id, created_by, updated_by, client_created_at, server_updated_at, deleted_at, seq',
    )
    .eq('household_id', householdId)
    .gt('seq', cursor)
    .order('seq', { ascending: true })
    .limit(limit);
  if (error) throw new PullTransportError(error.code ?? error.message);
  if (!Array.isArray(data)) throw new PullTransportError('events answered with something else');
  return (data as ServerRow[]).map(toPulled);
}
