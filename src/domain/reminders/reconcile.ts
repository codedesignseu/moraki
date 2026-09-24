import type { ScheduledReminder } from '../activities';

/** A notification the phone has already been asked to deliver. */
export type PlacedReminder = {
  /** The id the operating system gave it, needed to cancel it. */
  handle: string;
  /** Our own id, e.g. `feed:first`. */
  id: string;
  category: ScheduledReminder['category'];
  at: number;
  bodyKey: string;
  values?: Record<string, string>;
};

export type Reconciliation = {
  /** OS handles to cancel. */
  cancel: string[];
  /** Reminders to schedule, in time order. */
  schedule: ScheduledReminder[];
};

const same = (placed: PlacedReminder, wanted: ScheduledReminder) =>
  placed.at === wanted.at &&
  placed.bodyKey === wanted.bodyKey &&
  JSON.stringify(placed.values ?? {}) === JSON.stringify(wanted.values ?? {});

/**
 * What to cancel and what to schedule so the phone holds exactly `wanted`
 * (SDD 6.2). Pure, so the decision is testable without an operating system.
 *
 * SDD 6.2 says "cancel notifications with category 'feed'" and schedule the
 * new list. Doing that literally would cancel and re-create an unchanged
 * reminder on every write, which on a busy morning is a lot of churn for no
 * change — and on Android a cancel-then-schedule race can drop one. So a
 * reminder that already sits at the right minute with the right words is
 * left alone, and anything else in its category goes.
 */
export function reconcile(
  placed: readonly PlacedReminder[],
  wanted: readonly ScheduledReminder[],
): Reconciliation {
  // Everything the phone is holding for us, whatever its category: the port
  // only ever returns our own notifications, and the scheduler computes every
  // category in one pass, so anything placed that isn't wanted is stale.
  const ours = placed;

  const keep = new Set<string>();
  const schedule: ScheduledReminder[] = [];
  for (const want of wanted) {
    const match = ours.find((p) => p.id === want.id && same(p, want) && !keep.has(p.handle));
    if (match) keep.add(match.handle);
    else schedule.push(want);
  }

  return {
    cancel: ours.filter((p) => !keep.has(p.handle)).map((p) => p.handle),
    schedule: [...schedule].sort((a, b) => a.at - b.at),
  };
}
