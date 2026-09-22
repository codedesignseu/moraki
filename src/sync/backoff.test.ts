import { BACKOFF_MS, backoffMs } from './backoff';

describe('push backoff', () => {
  it('follows 2s, 5s, 15s, 60s, then every 5 minutes (SDD 5.2)', () => {
    expect([1, 2, 3, 4, 5].map(backoffMs)).toEqual([2_000, 5_000, 15_000, 60_000, 300_000]);
  });

  it('keeps waiting 5 minutes however long it goes on', () => {
    expect([6, 20, 500].map(backoffMs)).toEqual([300_000, 300_000, 300_000]);
  });

  it('never waits less than the first step', () => {
    expect([0, -3].map(backoffMs)).toEqual([BACKOFF_MS[0], BACKOFF_MS[0]]);
  });
});
