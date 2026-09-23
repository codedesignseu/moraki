import type { Auth } from './auth';

/** The household's own settings and its baby, as the server has them. */
export type PulledHousehold = {
  name: string;
  /** SDD 4.2: the household owns these, not the phone (P1-F16). */
  reminderIntervalMin: number;
  secondReminderMin: number | null;
  baby: { id: string; name: string; bornAt: number; birthWeightG: number | null } | null;
};

type ServerHousehold = {
  name: string;
  reminder_interval_min: number;
  second_reminder_min: number | null;
};

type ServerBaby = {
  id: string;
  name: string;
  born_at: string;
  birth_weight_g: number | null;
};

/**
 * The household row and its baby (SDD 4.2). A pull of events brings neither
 * (SDD 5.3), so without this a second phone never learns that the owner
 * changed the feed interval, renamed the baby or corrected a birth weight —
 * and two phones would show different reminder times, which SDD 6.2 says
 * must never happen.
 *
 * Returns null when the trip fails, so a pull that already stored its events
 * doesn't report itself as failed over this.
 */
export async function pullHousehold(
  auth: Auth,
  householdId: string,
): Promise<PulledHousehold | null> {
  const household = await auth.client
    .from('households')
    .select('name, reminder_interval_min, second_reminder_min')
    .eq('id', householdId)
    .limit(1);
  if (household.error || !Array.isArray(household.data)) return null;
  const row = (household.data as ServerHousehold[])[0];
  if (!row) return null;

  const babies = await auth.client
    .from('babies')
    .select('id, name, born_at, birth_weight_g')
    .eq('household_id', householdId)
    .is('deleted_at', null)
    .order('updated_at')
    .limit(1);
  const baby = Array.isArray(babies.data) ? (babies.data as ServerBaby[])[0] : undefined;

  return {
    name: row.name,
    reminderIntervalMin: row.reminder_interval_min,
    secondReminderMin: row.second_reminder_min,
    baby: baby
      ? {
          id: baby.id,
          name: baby.name,
          bornAt: Date.parse(baby.born_at),
          birthWeightG: baby.birth_weight_g,
        }
      : null,
  };
}
