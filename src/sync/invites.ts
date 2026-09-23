import type { Auth } from './auth';
import type { Relation } from './household';

/** An invite makes a caregiver or a viewer, never another owner (SDD 4.3). */
export const INVITE_ROLES = ['caregiver', 'viewer'] as const;
export type InviteRole = (typeof INVITE_ROLES)[number];
export type MemberRole = 'owner' | InviteRole;

export const CODE_LENGTH = 8;
/** moraki.app is the app's domain (SDD 0); `join/[code]` is the route it opens. */
const JOIN_URL = 'https://moraki.app/join/';

export type Invite = { code: string; expiresAt: number };

/** An invite the owner made and nobody has used yet (P2-F8). */
export type OpenInvite = Invite & { role: InviteRole };
export type Joined = { householdId: string; role: MemberRole; babyId: string; babyName: string };

export type InviteFailure =
  'not_found' | 'used' | 'expired' | 'already_in_household' | 'signed_out' | 'offline' | 'unknown';

export class InviteError extends Error {
  override name = 'InviteError';
  constructor(readonly reason: InviteFailure) {
    super(`Invite failed: ${reason}`);
  }
}

const REASONS: Record<string, InviteFailure> = {
  MKI01: 'not_found',
  MKI02: 'used',
  MKI03: 'expired',
  MKI04: 'already_in_household',
  '42501': 'signed_out',
};

function failure(error: { message?: string; code?: string }): InviteError {
  if (error.code && REASONS[error.code]) return new InviteError(REASONS[error.code]!);
  if (!error.code && /fetch|network/i.test(error.message ?? '')) return new InviteError('offline');
  return new InviteError('unknown');
}

/** Only the characters a code can contain, upper case, at most eight. */
export function normaliseCode(input: string): string {
  return input
    .toUpperCase()
    .replace(/[^ABCDEFGHJKMNPQRSTUVWXYZ23456789]/g, '')
    .slice(0, CODE_LENGTH);
}

/** `ABCD-EFGH`: easier to read out and to type. */
export function formatCode(code: string): string {
  const clean = normaliseCode(code);
  return clean.length > 4 ? `${clean.slice(0, 4)}-${clean.slice(4)}` : clean;
}

export function inviteLink(code: string): string {
  return JOIN_URL + normaliseCode(code);
}

/** The owner creates a single-use code; the server makes it and sets the expiry. */
export async function createInvite(
  auth: Auth,
  householdId: string,
  role: InviteRole,
): Promise<Invite> {
  const { data, error } = await auth.client
    .rpc('create_invite', { household_id: householdId, role })
    .select('code, expires_at')
    .single();
  if (error) throw failure(error);
  const row = data as { code: string; expires_at: string };
  return { code: row.code, expiresAt: Date.parse(row.expires_at) };
}

/**
 * The codes still waiting to be used, newest first (P2-F8). Only the owner
 * sees them: `invites_select` asks for `is_owner` (SDD 4.3), so on anyone
 * else's phone this comes back empty rather than refused.
 *
 * A used code is left out. An expired one is kept, because "it expired" is
 * the answer to "why hasn't it worked", and it can still be revoked to be
 * rid of it.
 */
export async function listInvites(auth: Auth, householdId: string): Promise<OpenInvite[]> {
  const { data, error } = await auth.client
    .from('invites')
    .select('code, role, expires_at')
    .eq('household_id', householdId)
    .is('used_at', null)
    // The table keeps no creation time, but an expiry is always seven days
    // after one, so this is newest first all the same.
    .order('expires_at', { ascending: false });
  if (error) throw failure(error);
  return (data as { code: string; role: InviteRole; expires_at: string }[]).map((row) => ({
    code: row.code,
    role: row.role,
    expiresAt: Date.parse(row.expires_at),
  }));
}

/**
 * Withdraws a code, so a link shared by mistake stops working now instead of
 * in seven days. Deleting it is the revocation: `accept_invite` then answers
 * not_found, exactly as it would for a code that never existed.
 */
export async function revokeInvite(auth: Auth, code: string): Promise<void> {
  const { error } = await auth.client.from('invites').delete().eq('code', normaliseCode(code));
  if (error) throw failure(error);
}

/** Redeems a code: joins the household with the invite's role. */
export async function acceptInvite(
  auth: Auth,
  code: string,
  displayName: string,
  relation: Relation | null,
): Promise<Joined> {
  const { data, error } = await auth.client
    .rpc('accept_invite', {
      code: normaliseCode(code),
      display_name: displayName.trim(),
      relation,
    })
    .select('household_id, role, baby_id, baby_name')
    .single();
  if (error) throw failure(error);
  const row = data as {
    household_id: string;
    role: MemberRole;
    baby_id: string;
    baby_name: string;
  };
  return {
    householdId: row.household_id,
    role: row.role,
    babyId: row.baby_id,
    babyName: row.baby_name,
  };
}
