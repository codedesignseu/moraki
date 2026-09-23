import { EMPTY_STOCK, getActivity, type Event, type Stock, type StockPlace } from '../activities';

export type PlaceState = {
  /** What is there, never below zero: the milk that isn't there can't be poured. */
  ml: number;
  /** When the oldest batch still in this place was pumped, for "oldest 3 days". */
  oldestAt: number | null;
  /**
   * More has been taken than this phone knows was put in, so the real amount
   * is anyone's guess and the app asks someone to check (SDD 6.3).
   */
  short: boolean;
};

export type StockState = { fridge: PlaceState; freezer: PlaceState };

function describe(batches: Stock[StockPlace]): PlaceState {
  const ml = batches.reduce((sum, batch) => sum + batch.ml, 0);
  const oldest = batches.find((batch) => batch.ml > 0);
  return { ml: Math.max(ml, 0), oldestAt: oldest?.at ?? null, short: ml < 0 };
}

/**
 * How much milk is where (SDD 6.3): a fold over the events in the order they
 * happened, oldest batch out first. Nothing is stored; two phones folding the
 * same events agree, whatever order the entries arrived in.
 */
export function selectStock(events: readonly Event<unknown>[]): StockState {
  const stock = [...events]
    .filter((event) => event.deletedAt === null)
    .sort((a, b) => a.occurredAt - b.occurredAt || a.id.localeCompare(b.id))
    .reduce<Stock>(
      (acc, event) => getActivity(event.type)?.contributes?.stock?.(acc, event) ?? acc,
      EMPTY_STOCK,
    );
  return { fridge: describe(stock.fridge), freezer: describe(stock.freezer) };
}
