/**
 * Keys in the `meta` table. The local_* ids are created by migration 0001 on
 * first launch and stand in for the real household, baby and user until sign
 * in (P2-11 swaps them). The rest are written once sync exists (P2).
 */
export const META_KEYS = {
  localHouseholdId: 'local_household_id',
  localBabyId: 'local_baby_id',
  localUserId: 'local_user_id',
  householdId: 'household_id',
  userId: 'user_id',
  pullCursor: 'pull_cursor',
} as const;
