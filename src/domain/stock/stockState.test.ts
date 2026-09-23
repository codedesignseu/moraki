import type { Event, EventType } from '../activities';
import { selectStock } from './stockState';

const HOUR = 3_600_000;
const NOW = Date.UTC(2026, 9, 28, 12, 0);

let seq = 0;
function ev<P>(
  type: EventType,
  occurredAt: number,
  payload: P,
  extra: Partial<Event<P>> = {},
): Event<P> {
  seq += 1;
  return {
    id: `e${String(seq).padStart(3, '0')}`,
    householdId: 'h',
    babyId: 'b',
    type,
    occurredAt,
    endedAt: null,
    payload,
    groupId: null,
    createdBy: 'me',
    updatedBy: 'me',
    clientCreatedAt: occurredAt,
    deletedAt: null,
    ...extra,
  };
}
const pump = (at: number, ml: number, dest: 'fridge' | 'freezer' | 'fed') =>
  ev('pump', at, { ml, dest });
const bottle = (at: number, ml: number, from?: 'fridge' | 'freezer') =>
  ev('feed_bottle', at, { ml, milk: 'breast', ...(from ? { from_stock: from } : {}) });
const adjust = (at: number, loc: 'fridge' | 'freezer', delta: number, reason = 'correction') =>
  ev('stock_adjust', at, { loc, delta_ml: delta, reason });

describe('milk in the fridge and freezer', () => {
  it('starts with nothing', () => {
    expect(selectStock([])).toEqual({
      fridge: { ml: 0, oldestAt: null, short: false },
      freezer: { ml: 0, oldestAt: null, short: false },
    });
  });

  it('adds what was pumped, to the place it went', () => {
    const stock = selectStock([
      pump(NOW - 5 * HOUR, 120, 'fridge'),
      pump(NOW - 3 * HOUR, 90, 'freezer'),
      pump(NOW - HOUR, 60, 'fed'), // fed straight away: never in a store
    ]);
    expect(stock.fridge).toEqual({ ml: 120, oldestAt: NOW - 5 * HOUR, short: false });
    expect(stock.freezer).toEqual({ ml: 90, oldestAt: NOW - 3 * HOUR, short: false });
  });

  it('pours from the oldest batch first, and ages by what is left', () => {
    const stock = selectStock([
      pump(NOW - 8 * HOUR, 100, 'fridge'),
      pump(NOW - 2 * HOUR, 150, 'fridge'),
      bottle(NOW - HOUR, 100, 'fridge'), // exactly the first batch
    ]);
    expect(stock.fridge).toEqual({ ml: 150, oldestAt: NOW - 2 * HOUR, short: false });
  });

  it('takes across batches when one isn’t enough', () => {
    const stock = selectStock([
      pump(NOW - 8 * HOUR, 100, 'fridge'),
      pump(NOW - 2 * HOUR, 150, 'fridge'),
      bottle(NOW - HOUR, 180, 'fridge'),
    ]);
    // 100 from the old batch, 80 from the newer one.
    expect(stock.fridge).toEqual({ ml: 70, oldestAt: NOW - 2 * HOUR, short: false });
  });

  it('leaves a bottle poured from nowhere in particular alone', () => {
    const stock = selectStock([pump(NOW - HOUR, 120, 'fridge'), bottle(NOW, 90)]);
    expect(stock.fridge.ml).toBe(120);
  });

  it('adds and removes by hand, keeping the reason with the entry', () => {
    const stock = selectStock([
      pump(NOW - 5 * HOUR, 100, 'freezer'),
      adjust(NOW - 4 * HOUR, 'freezer', 60), // found another bag
      adjust(NOW - HOUR, 'freezer', -40, 'discard'), // one went off
    ]);
    expect(stock.freezer.ml).toBe(120);
  });

  it('never shows less than nothing, and says the count needs checking', () => {
    const stock = selectStock([
      pump(NOW - 3 * HOUR, 60, 'fridge'),
      bottle(NOW - HOUR, 150, 'fridge'), // more than anyone put in
    ]);
    expect(stock.fridge).toEqual({ ml: 0, oldestAt: null, short: true });
  });

  it('settles once the entry that was missing arrives', () => {
    // The pump was logged on the other phone and came in later; folding by
    // when things happened puts it back in its place.
    const late = pump(NOW - 4 * HOUR, 200, 'fridge');
    const stock = selectStock([bottle(NOW - HOUR, 150, 'fridge'), late]);
    expect(stock.fridge).toEqual({ ml: 50, oldestAt: NOW - 4 * HOUR, short: false });
  });

  it('cancels what was owed before adding anything new', () => {
    const stock = selectStock([
      bottle(NOW - 3 * HOUR, 100, 'fridge'), // 100 owed
      pump(NOW - 2 * HOUR, 150, 'fridge'),
    ]);
    expect(stock.fridge).toEqual({ ml: 50, oldestAt: NOW - 2 * HOUR, short: false });
  });

  it('ages what is left from the milk that settled the count, not the debt', () => {
    // 100 went out that nobody logged going in. The next 60 goes to squaring
    // that, so the milk actually in the fridge is the 200 pumped after it.
    const stock = selectStock([
      bottle(NOW - 6 * HOUR, 100, 'fridge'),
      pump(NOW - 5 * HOUR, 60, 'fridge'),
      pump(NOW - 2 * HOUR, 200, 'fridge'),
    ]);
    expect(stock.fridge).toEqual({ ml: 160, oldestAt: NOW - 2 * HOUR, short: false });
  });

  it('pours from what is left once the debt is settled', () => {
    // Owed 100, then 150 in: the next bottle comes out of the 50 that is
    // really there, not off the books again.
    const stock = selectStock([
      bottle(NOW - 4 * HOUR, 100, 'fridge'),
      pump(NOW - 3 * HOUR, 150, 'fridge'),
      bottle(NOW - HOUR, 30, 'fridge'),
    ]);
    expect(stock.fridge).toEqual({ ml: 20, oldestAt: NOW - 3 * HOUR, short: false });
  });

  it('forgets an entry that was deleted', () => {
    const removed = pump(NOW - 2 * HOUR, 120, 'fridge');
    const stock = selectStock([{ ...removed, deletedAt: NOW - HOUR }]);
    expect(stock.fridge.ml).toBe(0);
  });

  it('keeps the two places apart', () => {
    const stock = selectStock([
      pump(NOW - 5 * HOUR, 100, 'fridge'),
      pump(NOW - 5 * HOUR, 200, 'freezer'),
      bottle(NOW - HOUR, 100, 'freezer'),
    ]);
    expect(stock.fridge.ml).toBe(100);
    expect(stock.freezer.ml).toBe(100);
  });

  it('gives the same answer whatever order the entries arrive in', () => {
    const entries = [
      pump(NOW - 6 * HOUR, 100, 'fridge'),
      bottle(NOW - 5 * HOUR, 40, 'fridge'),
      pump(NOW - 4 * HOUR, 90, 'fridge'),
      adjust(NOW - 2 * HOUR, 'fridge', -30, 'discard'),
    ];
    const forwards = selectStock(entries);
    const backwards = selectStock([...entries].reverse());
    expect(backwards).toEqual(forwards);
    expect(forwards.fridge.ml).toBe(120);
  });
});
