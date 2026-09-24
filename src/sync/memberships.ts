import type { Auth } from './auth';
import type { InviteRole, MemberRole } from './invites';

export type MembershipFailure = 'forbidden' | 'offline' | 'unknown';

export class MembershipError extends Error {
  override name = 'MembershipError';
  constructor(readonly reason: MembershipFailure) {
    super(`Membership change failed: ${reason}`);
  }
}

function failure(error: { message?: string; code?: string }): MembershipError {
  if (error.code === '42501') return new MembershipError('forbidden');
  // postgrest-js reports a failed request with no code.
  if (!error.code && /fetch|network/i.test(error.message ?? ''))
    return new MembershipError('offline');
  return new MembershipError('unknown');
}

/**
 * Changes what a caregiver may do (SDD 4.3, P4-07). Only the owner can: the
 * `memberships_self_update` trigger refuses a role change from anyone else,
 * whatever a client sends.
 *
 * An invite only ever grants caregiver or viewer, and so does this: handing
 * ownership to someone else is a different question, with different
 * consequences for deletion, and it is not asked here.
 */
export async function setCaregiverRole(
  auth: Auth,
  householdId: string,
  userId: string,
  role: InviteRole,
): Promise<void> {
  const { error } = await auth.client
    .from('memberships')
    .update({ role })
    .eq('household_id', householdId)
    .eq('user_id', userId);
  if (error) throw failure(error);
}

/**
 * Removes someone from the household. Their entries stay: they are the
 * household's record of what happened to the baby, not the person's
 * property, and deleting them would take away everyone else's history too.
 * What stops is their access.
 */
export async function removeCaregiver(
  auth: Auth,
  householdId: string,
  userId: string,
): Promise<void> {
  const { error } = await auth.client
    .from('memberships')
    .delete()
    .eq('household_id', householdId)
    .eq('user_id', userId);
  if (error) throw failure(error);
}

export type { MemberRole };
