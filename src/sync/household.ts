import type { Auth } from './auth';

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
  return { userId, householdId, babyId, babyName: input.babyName.trim() };
}

/**
 * The household the signed-in account already belongs to, if any: after a
 * reinstall, or on a second phone. RLS only returns the caller's own babies.
 */
export async function findHousehold(auth: Auth, userId: string): Promise<AccountHousehold | null> {
  const { data, error } = await auth.client
    .from('babies')
    .select('id, name, household_id')
    .is('deleted_at', null)
    .order('updated_at')
    .limit(1);
  if (error) throw failure(error);
  const baby = (data as { id: string; name: string; household_id: string }[])[0];
  return baby
    ? { userId, householdId: baby.household_id, babyId: baby.id, babyName: baby.name }
    : null;
}
