import { protectPending, type PendingOp, type PulledEvent } from './pendingProtection';

const SERVER: PulledEvent = {
  id: 'e1',
  householdId: 'h1',
  babyId: 'b1',
  type: 'feed_bottle',
  occurredAt: 1_000,
  endedAt: null,
  payload: { ml: 90, milk: 'formula' },
  groupId: null,
  createdBy: 'u1',
  updatedBy: 'u1',
  clientCreatedAt: 900,
  serverUpdatedAt: 5_000,
  seq: 7,
  deletedAt: null,
};
/** The same event as this phone has it, with the edit that hasn't been sent. */
const local = (changes: Partial<PulledEvent>): PulledEvent => ({ ...SERVER, ...changes });

describe('what a pull may overwrite', () => {
  it('takes the server copy when nothing is waiting', () => {
    expect(protectPending(SERVER, local({ payload: { ml: 10 } }), [])).toEqual(SERVER);
  });

  it('takes the server copy for an event this phone has never seen', () => {
    expect(protectPending(SERVER, null, [])).toEqual(SERVER);
  });

  it('keeps the whole local event while its insert is unsent', () => {
    expect(protectPending(SERVER, local({ payload: { ml: 120 } }), [{ op: 'insert' }])).toBeNull();
  });

  it('keeps the fields an unsent edit changed, and takes the rest', () => {
    const mine = local({ payload: { ml: 150, milk: 'formula' }, updatedBy: 'u2' });
    const waiting: PendingOp[] = [{ op: 'patch', payload: { ml: 150 } }];
    // The server has since learned the milk is breast, from the other phone.
    const server = { ...SERVER, payload: { ml: 90, milk: 'breast' }, seq: 9 };

    expect(protectPending(server, mine, waiting)).toEqual({
      ...server,
      payload: { ml: 150, milk: 'breast' }, // my amount, their correction
    });
  });

  it('keeps a field the edit cleared, rather than letting the server put it back', () => {
    const mine = local({ payload: { note: 'warm' } });
    const server = { ...SERVER, payload: { note: 'warm', temp_c: 37.8 } };
    const waiting: PendingOp[] = [{ op: 'patch', unset: ['temp_c'] }];

    expect(protectPending(server, mine, waiting)?.payload).toEqual({ note: 'warm' });
  });

  it('keeps times an unsent edit moved, and leaves untouched times to the server', () => {
    const mine = local({ occurredAt: 2_000, endedAt: 2_500 });
    const server = { ...SERVER, occurredAt: 1_100, endedAt: 1_600 };

    expect(protectPending(server, mine, [{ op: 'patch', occurredAt: 2_000 }])).toMatchObject({
      occurredAt: 2_000, // mine, still waiting
      endedAt: 1_600, // theirs: my edit didn't touch it
    });
    expect(protectPending(server, mine, [{ op: 'patch', endedAt: 2_500 }])).toMatchObject({
      occurredAt: 1_100,
      endedAt: 2_500,
    });
  });

  it('keeps an unsent delete deleted, whatever the server still shows', () => {
    const mine = local({ deletedAt: 4_000 });
    expect(protectPending(SERVER, mine, [{ op: 'delete', deletedAt: 4_000 }])).toMatchObject({
      deletedAt: 4_000,
    });
  });

  it('applies several waiting edits, in the order they were made', () => {
    const mine = local({ payload: { ml: 200, milk: 'formula' }, occurredAt: 3_000 });
    const server = { ...SERVER, payload: { ml: 90, milk: 'breast', note: 'from the other phone' } };
    const waiting: PendingOp[] = [
      { op: 'patch', payload: { ml: 150 } },
      { op: 'patch', payload: { ml: 200 }, occurredAt: 3_000 },
    ];

    expect(protectPending(server, mine, waiting)).toMatchObject({
      payload: { ml: 200, milk: 'breast', note: 'from the other phone' },
      occurredAt: 3_000,
    });
  });

  it('never lets a pull revive an event deleted here but not yet sent', () => {
    const mine = local({ deletedAt: 4_000, payload: { ml: 90, milk: 'formula' } });
    const server = { ...SERVER, deletedAt: null, seq: 11 };
    const merged = protectPending(server, mine, [{ op: 'delete', deletedAt: 4_000 }]);
    expect(merged?.deletedAt).toBe(4_000);
    expect(merged?.seq).toBe(11); // the server's place in the order is still taken
  });
});
