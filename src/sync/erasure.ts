import type { Auth } from './auth';

/**
 * Why leaving or deleting failed:
 * - `forbidden`: the server says this account may not (no longer a member,
 *   or not the owner);
 * - `only_member`: the last member can't leave, only delete the household;
 * - `successor`: the person named as the next owner isn't in the household;
 * - `offline`: the request never reached the server;
 * - `unknown`: anything else.
 */
export type ErasureFailure = 'forbidden' | 'only_member' | 'successor' | 'offline' | 'unknown';

export class ErasureError extends Error {
  override name = 'ErasureError';
  constructor(readonly reason: ErasureFailure) {
    super(`Erasure failed: ${reason}`);
  }
}

function failure(error: { message?: string; code?: string }): ErasureError {
  if (error.code === '42501') return new ErasureError('forbidden');
  if (error.code === '23001') return new ErasureError('only_member');
  if (error.code === '22023') return new ErasureError('successor');
  // postgrest-js reports a failed request with no code.
  if (!error.code && /fetch|network/i.test(error.message ?? '')) return new ErasureError('offline');
  return new ErasureError('unknown');
}

async function call(auth: Auth, fn: string, args?: Record<string, unknown>): Promise<void> {
  const { error } = await auth.client.rpc(fn, args);
  if (error) throw failure(error);
}

/**
 * Leaves a household others carry on with (P4-06, `leave_household`). If this
 * account held the last owner seat, `successor` becomes owner (D3).
 */
export function leaveHousehold(
  auth: Auth,
  householdId: string,
  successor: string | null,
): Promise<void> {
  return call(auth, 'leave_household', { household_id: householdId, successor });
}

/** Deletes the household for everyone: baby, entries, invites. Owner only. */
export function deleteHousehold(auth: Auth, householdId: string): Promise<void> {
  return call(auth, 'delete_household', { household_id: householdId });
}

/**
 * Deletes this account (`delete_account`), naming the next owner of a shared
 * household where this account is the last owner (D3), then signs this phone out. The
 * server does it in one transaction; there is nothing to undo on the phone if
 * it fails.
 */
export async function deleteAccount(auth: Auth, successor: string | null): Promise<void> {
  await call(auth, 'delete_account', { successor });
  await auth.signOut();
}
