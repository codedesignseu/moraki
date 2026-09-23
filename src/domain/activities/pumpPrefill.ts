import type { Event } from './contract';
import type { PumpPayload } from './pump';
import { isPump } from './queries';

export type PumpPrefill = {
  ml: number;
  dest: PumpPayload['dest'];
};

/** The pump sheet's amount stepper. */
export const PUMP_ML = { step: 10, min: 10, max: 600 } as const;

/** Used only before a pump session is ever logged. */
export const FIRST_PUMP_DEFAULTS: PumpPrefill = { ml: 100, dest: 'fridge' };

/**
 * What the pump sheet opens with (SDD 7): the last session's amount and where
 * it went, since pumping tends to repeat. Derived each time, never stored.
 */
export function pumpPrefill(events: readonly Event<unknown>[]): PumpPrefill {
  const last = events
    .filter((e) => e.deletedAt === null)
    .filter(isPump)
    .reduce<Event<PumpPayload> | null>(
      (best, e) => (best === null || e.occurredAt > best.occurredAt ? e : best),
      null,
    );
  return last ? { ml: last.payload.ml, dest: last.payload.dest } : FIRST_PUMP_DEFAULTS;
}
