import type { Caregiver } from '@/db/repositories/caregivers';

import type { Auth } from './auth';

type ServerMember = {
  household_id: string;
  user_id: string;
  role: 'owner' | 'caregiver' | 'viewer';
  display_name: string;
  relation: Caregiver['relation'];
  joined_at: string;
};

/**
 * Who is in the household, as the server has it. A pull of events brings no
 * names (SDD 5.3, P2-F11), and without them every entry from the other phone
 * would read as a stranger.
 */
export async function pullCaregivers(auth: Auth, householdId: string): Promise<Caregiver[]> {
  const { data, error } = await auth.client
    .from('memberships')
    .select('household_id, user_id, role, display_name, relation, joined_at')
    .eq('household_id', householdId);
  if (error || !Array.isArray(data)) return [];
  return (data as ServerMember[]).map((row) => ({
    householdId: row.household_id,
    userId: row.user_id,
    role: row.role,
    displayName: row.display_name,
    relation: row.relation,
    joinedAt: Date.parse(row.joined_at),
  }));
}
