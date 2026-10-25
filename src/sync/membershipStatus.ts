import {
  CAREGIVER_AGREEMENT_VERSION,
  type ConsentLocale,
  type HouseholdAccess,
} from '@/domain/consent/consent';

import type { Auth } from './auth';

/** As invites.ts has it; written out here so the two modules don't import each other. */
type MemberRole = 'owner' | 'caregiver' | 'viewer';

/**
 * Where the signed-in account stands with a household (P0.2,
 * `my_membership_status`): still a member, and if so whether it may see the
 * baby's data or which agreement is missing; or no longer a member; or the
 * household is gone. For a member, the baby's id and first name, which the
 * phone needs to find its household before it may read the baby's row.
 */
export type MembershipStatus =
  | {
      status: 'member';
      role: MemberRole;
      isGuardian: boolean;
      access: HouseholdAccess;
      baby: { id: string; name: string } | null;
    }
  | { status: 'not_member' }
  | { status: 'household_gone' };

/** The server couldn't be asked, or didn't answer clearly: never a reason to act. */
export class MembershipStatusError extends Error {
  override name = 'MembershipStatusError';
}

type Row = {
  status: string;
  role: MemberRole | null;
  is_guardian: boolean | null;
  access: HouseholdAccess | null;
  baby_id: string | null;
  baby_name: string | null;
};

/** Asks the server. Throws MembershipStatusError for anything but a clear answer. */
export async function fetchMembershipStatus(
  auth: Auth,
  householdId: string,
): Promise<MembershipStatus> {
  let row: Row | undefined;
  try {
    const { data, error } = await auth.client.rpc('my_membership_status', {
      household_id: householdId,
    });
    if (error) throw new MembershipStatusError(error.code ?? 'request failed');
    row = (Array.isArray(data) ? data[0] : data) as Row | undefined;
  } catch (error) {
    if (error instanceof MembershipStatusError) throw error;
    throw new MembershipStatusError('request failed');
  }
  if (row?.status === 'not_member' || row?.status === 'household_gone') {
    return { status: row.status };
  }
  if (row?.status !== 'member' || !row.role || !row.access) {
    throw new MembershipStatusError('unexpected answer');
  }
  return {
    status: 'member',
    role: row.role,
    isGuardian: row.is_guardian === true,
    access: row.access,
    baby: row.baby_id && row.baby_name ? { id: row.baby_id, name: row.baby_name } : null,
  };
}

/**
 * Records, as the signed-in member, accepting the caregiver agreement for
 * their household (P0.2) through `record_consent`.
 */
export async function recordCaregiverAgreement(
  auth: Auth,
  householdId: string,
  locale: ConsentLocale,
): Promise<void> {
  const { error } = await auth.client.rpc('record_consent', {
    purpose: 'caregiver_agreement',
    version: CAREGIVER_AGREEMENT_VERSION,
    action: 'grant',
    household_id: householdId,
    locale,
    text_key: 'caregiverAgreement',
  });
  if (error) {
    const offline = !error.code && /fetch|network/i.test(error.message ?? '');
    throw new Error(offline ? 'offline' : 'unknown');
  }
}
