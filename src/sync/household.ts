import type { Auth } from './auth';
import type { MemberRole } from './invites';

export const RELATIONS = ['mother', 'father', 'grandparent', 'caregiver', 'other'] as const;
export type Relation = (typeof RELATIONS)[number];

export type NewHousehold = {
  babyName: string;
  /** UTC epoch ms. */
  bornAt: number;
  birthWeightG: number | null;
  displayName: string;
  relation: Relation | null;
};

export type AccountHousehold = {
  userId: string;
  householdId: string;
  babyId: string;
  babyName: string;
  /** When the baby was born, and the birth weight if one was recorded (P3-05). */
  bornAt?: number | undefined;
  birthWeightG?: number | null | undefined;
  /** What this account may do in it (SDD 4.3). */
  role: MemberRole;
};

export class HouseholdError extends Error {
  override name = 'HouseholdError';
  constructor(readonly reason: 'offline' | 'signed_out' | 'unknown') {
    super(`Household setup failed: ${reason}`);
  }
}

function failure(error: { message?: string; code?: string }): HouseholdError {
  // postgrest-js reports a failed request with the fetch error's message and no code.
  if (!error.code && /fetch|network/i.test(error.message ?? ''))
    return new HouseholdError('offline');
  if (error.code === '42501') return new HouseholdError('signed_out');
  return new HouseholdError('unknown');
}

/**
 * Creates the household on the server (SDD 4.3, create_household): the
 * household, the signed-in user as owner, and the baby, in one transaction.
 * The ids are made here, so retrying the same call can't make a second one.
 */
export async function createHousehold(
  auth: Auth,
  userId: string,
  input: NewHousehold,
  newId: () => string,
): Promise<AccountHousehold> {
  const householdId = newId();
  const babyId = newId();
  const { error } = await auth.client.rpc('create_household', {
    household_id: householdId,
    baby_id: babyId,
    baby_name: input.babyName.trim(),
    born_at: new Date(input.bornAt).toISOString(),
    display_name: input.displayName.trim(),
    relation: input.relation,
    birth_weight_g: input.birthWeightG,
  });
  if (error) throw failure(error);
  return {
    userId,
    householdId,
    babyId,
    babyName: input.babyName.trim(),
    bornAt: input.bornAt,
    birthWeightG: input.birthWeightG,
    role: 'owner',
  };
}

/**
 * The household the signed-in account already belongs to, if any: after a
 * reinstall, on a second phone, or after joining one elsewhere. RLS returns
 * only the caller's own membership and their household's babies.
 */
export async function findHousehold(auth: Auth, userId: string): Promise<AccountHousehold | null> {
  const membership = await auth.client
    .from('memberships')
    .select('household_id, role')
    .eq('user_id', userId)
    .limit(1);
  if (membership.error) throw failure(membership.error);
  const mine = (membership.data as { household_id: string; role: MemberRole }[])[0];
  if (!mine) return null;

  const babies = await auth.client
    .from('babies')
    .select('id, name, born_at, birth_weight_g')
    .eq('household_id', mine.household_id)
    .is('deleted_at', null)
    .order('updated_at')
    .limit(1);
  if (babies.error) throw failure(babies.error);
  const baby = (
    babies.data as {
      id: string;
      name: string;
      born_at?: string;
      birth_weight_g?: number | null;
    }[]
  )[0];
  if (!baby) return null;
  // A household made before these columns were read back has neither; the
  // weight view simply has no day to count from until the next pull.
  const bornAt = baby.born_at === undefined ? NaN : Date.parse(baby.born_at);
  return {
    userId,
    householdId: mine.household_id,
    babyId: baby.id,
    babyName: baby.name,
    ...(Number.isFinite(bornAt) && { bornAt }),
    ...(baby.birth_weight_g !== undefined && { birthWeightG: baby.birth_weight_g }),
    role: mine.role,
  };
}

export type BabyDetails = {
  name: string;
  /** UTC epoch ms. */
  bornAt: number;
  birthWeightG: number | null;
};

/**
 * Corrects the baby's details on the server (P4-10). A mistyped birth date
 * or weight is not a small thing: day 0 and the 90% line of the weight chart
 * are both measured from them (SDD 6.4).
 *
 * Any writer may (SDD 4.3 `babies_update` asks for `can_write`), because a
 * typo is usually noticed by whoever is holding the baby, not by whoever
 * created the household. A viewer cannot, and the server refuses it.
 */
export async function updateBaby(auth: Auth, babyId: string, details: BabyDetails): Promise<void> {
  const { error } = await auth.client
    .from('babies')
    .update({
      name: details.name.trim(),
      born_at: new Date(details.bornAt).toISOString(),
      birth_weight_g: details.birthWeightG,
      updated_at: new Date().toISOString(),
    })
    .eq('id', babyId);
  if (error) throw failure(error);
}
