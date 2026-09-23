import type { Auth } from './auth';
import { watchHousehold } from './realtime';

/** A stand-in channel that remembers how it was set up. */
function client() {
  const calls: { on?: unknown[]; channel?: string; removed: unknown[] } = { removed: [] };
  let notify: (() => void) | undefined;
  let statusOf: ((status: string) => void) | undefined;
  const channel = {
    on: (...args: unknown[]) => {
      calls.on = args;
      notify = args[2] as () => void;
      return channel;
    },
    subscribe: (listener: (status: string) => void) => {
      statusOf = listener;
      return channel;
    },
  };
  const setAuth = jest.fn();
  const auth = {
    client: {
      channel: (name: string) => {
        calls.channel = name;
        return channel;
      },
      removeChannel: (c: unknown) => calls.removed.push(c),
      auth: { getSession: async () => ({ data: { session: { access_token: 'token-abc' } } }) },
      realtime: { setAuth },
    },
  } as unknown as Auth;
  return { auth, calls, setAuth, ping: () => notify?.(), status: (s: string) => statusOf?.(s) };
}

describe('listening for changes in the household', () => {
  it('subscribes to this household’s events only', () => {
    const fake = client();
    watchHousehold(fake.auth, 'h1', { onPing: () => {}, onConnected: () => {} });

    expect(fake.calls.channel).toBe('household:h1');
    expect(fake.calls.on?.[0]).toBe('postgres_changes');
    expect(fake.calls.on?.[1]).toEqual({
      event: '*',
      schema: 'public',
      table: 'events',
      filter: 'household_id=eq.h1',
    });
  });

  it('passes on a ping without looking at what changed (SDD 5.4)', () => {
    const fake = client();
    const onPing = jest.fn();
    watchHousehold(fake.auth, 'h1', { onPing, onConnected: () => {} });

    fake.ping();
    fake.ping();
    expect(onPing).toHaveBeenCalledTimes(2);
    expect(onPing).toHaveBeenCalledWith(); // no payload is handed on
  });

  it('says the connection is up each time the channel joins, including after a drop', () => {
    const fake = client();
    const onConnected = jest.fn();
    watchHousehold(fake.auth, 'h1', { onPing: () => {}, onConnected });

    fake.status('SUBSCRIBED');
    fake.status('CHANNEL_ERROR');
    fake.status('CLOSED');
    expect(onConnected).toHaveBeenCalledTimes(1);

    fake.status('SUBSCRIBED'); // the socket came back and rejoined
    expect(onConnected).toHaveBeenCalledTimes(2);
  });

  it('gives realtime the signed-in token, so it is told anything at all', async () => {
    const fake = client();
    watchHousehold(fake.auth, 'h1', { onPing: () => {}, onConnected: () => {} });
    await Promise.resolve();
    await Promise.resolve();
    expect(fake.setAuth).toHaveBeenCalledWith('token-abc');
  });

  it('lets go of the channel when it is closed', () => {
    const fake = client();
    watchHousehold(fake.auth, 'h1', { onPing: () => {}, onConnected: () => {} }).close();
    expect(fake.calls.removed).toHaveLength(1);
  });
});
