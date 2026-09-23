import type { Event, EventType } from './contract';
import { FIRST_PUMP_DEFAULTS, pumpPrefill } from './pumpPrefill';

let n = 0;
function ev<P>(type: EventType, occurredAt: number, payload: P, deletedAt: number | null = null) {
  n += 1;
  return {
    id: `e${n}`,
    householdId: 'h',
    babyId: 'b',
    type,
    occurredAt,
    endedAt: null,
    payload,
    groupId: null,
    createdBy: 'u',
    updatedBy: 'u',
    clientCreatedAt: occurredAt,
    deletedAt,
  } satisfies Event<P>;
}

describe('pumpPrefill', () => {
  it('uses the defaults before anything is pumped', () => {
    expect(pumpPrefill([])).toEqual(FIRST_PUMP_DEFAULTS);
  });

  it('opens with the last session’s amount and where it went', () => {
    const events = [
      ev('pump', 100, { ml: 80, dest: 'fridge' }),
      ev('pump', 200, { ml: 140, dest: 'freezer' }),
    ];
    expect(pumpPrefill(events)).toEqual({ ml: 140, dest: 'freezer' });
  });

  it('goes by when it happened, not by the order it was stored', () => {
    const events = [
      ev('pump', 300, { ml: 60, dest: 'fed' }),
      ev('pump', 100, { ml: 200, dest: 'fridge' }),
    ];
    expect(pumpPrefill(events)).toEqual({ ml: 60, dest: 'fed' });
  });

  it('ignores a deleted session and other kinds of entry', () => {
    const events = [
      ev('pump', 100, { ml: 80, dest: 'fridge' }),
      ev('pump', 300, { ml: 500, dest: 'freezer' }, 400),
      ev('feed_bottle', 350, { ml: 90, milk: 'breast' }),
    ];
    expect(pumpPrefill(events)).toEqual({ ml: 80, dest: 'fridge' });
  });
});
