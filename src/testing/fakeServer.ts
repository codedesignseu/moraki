/// <reference types="node" />
// Test-only: the server's side of sync, in memory. It follows push_events
// (SDD 5.2, P2-07) and the pull query (SDD 5.3), which pgTAP tests against
// the real database; here it lets thousands of interleavings run in seconds.
import type { PulledEvent } from '@/domain/sync/pendingProtection';
import type { OutboxRow } from '@/db/repositories/outbox';
import type { PushResult } from '@/sync/pushEvents';

type Stored = PulledEvent & { seq: number };

export function createFakeServer(householdId: string, babyId: string) {
  const rows = new Map<string, Stored>();
  let seq = 0;

  const bump = (row: Stored) => {
    seq += 1;
    return { ...row, seq, serverUpdatedAt: seq };
  };

  return {
    /** push_events: insert is idempotent, patch merges, delete wins. */
    push(userId: string, ops: readonly OutboxRow[], now: number): PushResult[] {
      return ops.map((op): PushResult => {
        const body = JSON.parse(op.body) as Record<string, unknown>;
        const id = String(body.id);
        const existing = rows.get(id);
        const answer = (status: PushResult['status'], reason: string | null = null) => ({
          id,
          op: op.op,
          status,
          reason,
        });

        if (op.notBefore !== null && op.notBefore > now) return answer('deferred', 'not_before');

        if (op.op === 'insert') {
          if (existing) return answer('ignored', existing.deletedAt ? 'deleted' : 'duplicate');
          rows.set(
            id,
            bump({
              id,
              householdId,
              babyId,
              type: String(body.type),
              occurredAt: Number(body.occurred_at),
              endedAt:
                body.ended_at === null || body.ended_at === undefined
                  ? null
                  : Number(body.ended_at),
              payload: (body.payload ?? {}) as Record<string, unknown>,
              groupId: (body.group_id as string | null) ?? null,
              createdBy: userId,
              updatedBy: userId,
              clientCreatedAt: Number(body.client_created_at),
              serverUpdatedAt: 0,
              seq: 0,
              deletedAt: null,
            }),
          );
          return answer('applied');
        }

        if (!existing) return answer('rejected', 'not_found');
        if (existing.deletedAt !== null) return answer('ignored', 'deleted');

        if (op.op === 'delete') {
          rows.set(
            id,
            bump({ ...existing, deletedAt: Number(body.deleted_at ?? now), updatedBy: userId }),
          );
          return answer('applied');
        }

        const payload = { ...existing.payload, ...((body.payload ?? {}) as object) };
        for (const key of (body.unset as string[] | undefined) ?? []) delete payload[key];
        rows.set(
          id,
          bump({
            ...existing,
            payload,
            occurredAt: 'occurred_at' in body ? Number(body.occurred_at) : existing.occurredAt,
            endedAt:
              'ended_at' in body
                ? body.ended_at === null
                  ? null
                  : Number(body.ended_at)
                : existing.endedAt,
            updatedBy: userId,
          }),
        );
        return answer('applied');
      });
    },

    /** The pull query: this household, after the cursor, oldest change first. */
    page(cursor: number, limit: number): PulledEvent[] {
      return [...rows.values()]
        .filter((row) => row.seq > cursor)
        .sort((a, b) => a.seq - b.seq)
        .slice(0, limit);
    },

    all(): Stored[] {
      return [...rows.values()].sort((a, b) => a.id.localeCompare(b.id));
    },
  };
}

export type FakeServer = ReturnType<typeof createFakeServer>;
