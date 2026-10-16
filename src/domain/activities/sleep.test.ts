import type { Event } from './contract';
import { sleepModule, type SleepPayload } from './sleep';

const MIN = 60_000;

const sleep = (endedAt: number | null): Event<SleepPayload> => ({
  id: 'e',
  householdId: 'h',
  babyId: 'b',
  type: 'sleep',
  occurredAt: 0,
  endedAt,
  payload: {},
  groupId: null,
  createdBy: 'u',
  updatedBy: 'u',
  clientCreatedAt: 0,
  deletedAt: null,
});

describe('sleep summary', () => {
  it('says a running sleep is running', () => {
    expect(sleepModule.summarize?.(sleep(null))).toEqual({ key: 'activity.sleep.summary.running' });
  });

  it.each([
    [42 * MIN + 59_000, { key: 'activity.sleep.summary.minutes', values: { minutes: 42 } }],
    [80 * MIN, { key: 'activity.sleep.summary.hours', values: { hours: 1, minutes: '20' } }],
    [125 * MIN, { key: 'activity.sleep.summary.hours', values: { hours: 2, minutes: '05' } }],
  ])('words a sleep of %i ms as hours and padded minutes', (ms, expected) => {
    expect(sleepModule.summarize?.(sleep(ms))).toEqual(expected);
  });
});
