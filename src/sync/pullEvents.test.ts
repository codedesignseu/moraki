import type { Auth } from './auth';
import { pullPage, PULL_PAGE, PullTransportError } from './pullEvents';

/** A stand-in for the query builder, remembering what was asked for. */
function client(answer: {
  data?: unknown;
  error?: { code?: string; message: string } | undefined;
}) {
  const calls: Record<string, unknown> = {};
  const builder = {
    select: (columns: string) => ((calls.select = columns), builder),
    eq: (column: string, value: unknown) => ((calls.eq = [column, value]), builder),
    gt: (column: string, value: unknown) => ((calls.gt = [column, value]), builder),
    order: (column: string, options: unknown) => ((calls.order = [column, options]), builder),
    limit: (n: number) => {
      calls.limit = n;
      return Promise.resolve(answer);
    },
  };
  const from = jest.fn(() => builder);
  return { auth: { client: { from } } as unknown as Auth, calls, from };
}

const serverRow = {
  id: 'e1',
  household_id: 'h1',
  baby_id: 'b1',
  type: 'feed_bottle',
  occurred_at: '2026-10-28T09:00:00+00:00',
  ended_at: null,
  payload: { ml: 90, milk: 'formula' },
  group_id: null,
  created_by: 'u1',
  updated_by: 'u2',
  client_created_at: '2026-10-28T08:59:00+00:00',
  server_updated_at: '2026-10-28T09:01:00+00:00',
  deleted_at: null,
  seq: 12,
};

describe('reading a page of the household’s events', () => {
  it('asks for this household, after the cursor, oldest change first (SDD 5.3)', async () => {
    const { auth, calls, from } = client({ data: [], error: undefined });
    await pullPage(auth, 'h1', 7);

    expect(from).toHaveBeenCalledWith('events');
    expect(calls.eq).toEqual(['household_id', 'h1']);
    expect(calls.gt).toEqual(['seq', 7]);
    expect(calls.order).toEqual(['seq', { ascending: true }]);
    expect(calls.limit).toBe(PULL_PAGE);
    expect(String(calls.select)).toContain('deleted_at'); // deletes are changes too
  });

  it('turns server times into epoch milliseconds (rule 5)', async () => {
    const { auth } = client({ data: [serverRow], error: undefined });
    expect(await pullPage(auth, 'h1', 0)).toEqual([
      {
        id: 'e1',
        householdId: 'h1',
        babyId: 'b1',
        type: 'feed_bottle',
        occurredAt: Date.parse('2026-10-28T09:00:00Z'),
        endedAt: null,
        payload: { ml: 90, milk: 'formula' },
        groupId: null,
        createdBy: 'u1',
        updatedBy: 'u2',
        clientCreatedAt: Date.parse('2026-10-28T08:59:00Z'),
        serverUpdatedAt: Date.parse('2026-10-28T09:01:00Z'),
        seq: 12,
        deletedAt: null,
      },
    ]);
  });

  it('reads a deleted event as deleted, not as missing', async () => {
    const { auth } = client({
      data: [{ ...serverRow, deleted_at: '2026-10-28T10:00:00+00:00' }],
      error: undefined,
    });
    expect((await pullPage(auth, 'h1', 0))[0]).toMatchObject({
      deletedAt: Date.parse('2026-10-28T10:00:00Z'),
    });
  });

  it('treats a failed request as a transport failure, so the cursor stays put', async () => {
    const { auth } = client({ data: null, error: { message: 'Network request failed' } });
    await expect(pullPage(auth, 'h1', 0)).rejects.toBeInstanceOf(PullTransportError);
  });

  it('refuses an answer that is not a list of rows', async () => {
    const { auth } = client({ data: { rows: [] }, error: undefined });
    await expect(pullPage(auth, 'h1', 0)).rejects.toBeInstanceOf(PullTransportError);
  });
});
