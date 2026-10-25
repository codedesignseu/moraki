import type { ConsentLocale } from '@/domain/consent/consent';

import type { Auth } from './auth';

/**
 * Why leaving or deleting failed:
 * - `forbidden`: the server says this account may not (no longer a member,
 *   or not the owner);
 * - `only_member`: the last member can't leave, only delete the household;
 * - `successor`: the person named as the next owner isn't in the household,
 *   or hasn't declared they are the baby's parent or guardian;
 * - `no_guardian`: nobody else has declared, so nobody can take over (P0.1);
 * - `offline`: the request never reached the server;
 * - `apple_cancelled`: the person closed Apple's sheet instead of confirming;
 * - `apple_revoke`: Apple's tokens could not be revoked, so nothing was deleted;
 * - `unknown`: anything else.
 */
export type ErasureFailure =
  | 'forbidden'
  | 'only_member'
  | 'successor'
  | 'no_guardian'
  | 'offline'
  | 'apple_cancelled'
  | 'apple_revoke'
  | 'unknown';

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
  if (error.code === 'MK002') return new ErasureError('no_guardian');
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
  locale: ConsentLocale,
): Promise<void> {
  // Leaving ends a caregiver agreement; the server records that, in the
  // language of the screen that confirmed it (P0.3).
  return call(auth, 'leave_household', { household_id: householdId, successor, locale });
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

/**
 * Revokes this account's Sign in with Apple tokens (App Store guideline
 * 5.1.1(v)) through the `apple-revoke` Edge Function, which exchanges the
 * fresh `authorizationCode` from Apple's sheet for a refresh token and
 * revokes it. Runs before `deleteAccount`: if it fails, nothing is deleted
 * and the person can try again. The code itself is never logged.
 */
export async function revokeAppleTokens(auth: Auth, authorizationCode: string): Promise<void> {
  const { data, error } = await auth.client.functions.invoke<{ revoked?: boolean }>(
    'apple-revoke',
    { body: { authorizationCode } },
  );
  if (error) {
    // functions-js: FunctionsFetchError when the request never got there.
    const name = (error as { name?: string }).name;
    throw new ErasureError(name === 'FunctionsFetchError' ? 'offline' : 'apple_revoke');
  }
  if (data?.revoked !== true) throw new ErasureError('apple_revoke');
}
