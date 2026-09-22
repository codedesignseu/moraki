import type { OutboxRow } from '@/db/repositories/outbox';

import type { Auth } from './auth';
import { pushOps, PushTransportError } from './pushEvents';

const row = (id: number, notBefore: number | null = null): OutboxRow => ({
  id,
  entity: 'event',
  entityId: `0190a0b0-0000-7000-8000-00000000000${id}`,
  op: 'insert',
  body: JSON.stringify({ id: `0190a0b0-0000-7000-8000-00000000000${id}`, type: 'diaper' }),
  attempts: 0,
  lastError: null,
  createdAt: 0,
  notBefore,
});

/** An auth whose client answers push_events however the test says. */
function auth(rpc: jest.Mock): Auth {
  return { client: { rpc } } as unknown as Auth;
}

describe('sending a batch to push_events', () => {
  it('sends each op with its body and its hold, and returns the answers', async () => {
    const rpc = jest.fn().mockResolvedValue({
      data: [{ id: 'x', op: 'insert', status: 'applied', reason: null }],
      error: null,
    });
    const results = await pushOps(auth(rpc), [row(1, 1_700_000_000_000)]);

    expect(rpc).toHaveBeenCalledWith('push_events', {
      ops: [
        {
          op: 'insert',
          not_before: 1_700_000_000_000,
          body: { id: '0190a0b0-0000-7000-8000-000000000001', type: 'diaper' },
        },
      ],
    });
    expect(results).toEqual([{ id: 'x', op: 'insert', status: 'applied', reason: null }]);
  });

  it('leaves out not_before for an op with no hold', async () => {
    const rpc = jest.fn().mockResolvedValue({ data: [], error: null });
    await pushOps(auth(rpc), []);
    expect(rpc).toHaveBeenCalledWith('push_events', { ops: [] });
  });

  it('treats a failed request as a transport failure, so the ops stay queued', async () => {
    const rpc = jest
      .fn()
      .mockResolvedValue({ data: null, error: { message: 'Network request failed' } });
    await expect(pushOps(auth(rpc), [row(1)])).rejects.toBeInstanceOf(PushTransportError);
  });

  it('refuses an answer that does not match the ops sent', async () => {
    const rpc = jest.fn().mockResolvedValue({
      data: [{ id: 'x', op: 'insert', status: 'applied', reason: null }],
      error: null,
    });
    // Two ops, one answer: the engine can't tell which was applied, so nothing
    // is cleared and the batch is tried again.
    await expect(pushOps(auth(rpc), [row(1), row(2)])).rejects.toBeInstanceOf(PushTransportError);

    const notAList = jest.fn().mockResolvedValue({ data: { ok: true }, error: null });
    await expect(pushOps(auth(notAList), [row(1)])).rejects.toBeInstanceOf(PushTransportError);
  });
});
