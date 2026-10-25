import { GUARDIAN_DECLARATION_VERSION, type ConsentLocale } from '@/domain/consent/consent';

import type { Auth } from './auth';

/**
 * Whether this account's guardian declaration for the household is on the
 * server's record (P0.1): a consent_events row the account can read, as RLS
 * shows each person only their own. Null when the server couldn't be asked.
 */
export async function guardianOnRecord(
  auth: Auth,
  userId: string,
  householdId: string,
): Promise<boolean | null> {
  try {
    const { data, error } = await auth.client
      .from('consent_events')
      .select('id')
      .eq('user_id', userId)
      .eq('purpose', 'guardian_declaration')
      .eq('household_id', householdId)
      .limit(1);
    if (error || !Array.isArray(data)) return null;
    return data.length > 0;
  } catch {
    return null;
  }
}

/**
 * Declares, as the signed-in member, that they are the baby's parent or
 * legal guardian (`declare_guardian`). The server marks the membership and
 * records the declaration with its version and language.
 */
export async function declareGuardian(
  auth: Auth,
  householdId: string,
  locale: ConsentLocale,
): Promise<void> {
  const { error } = await auth.client.rpc('declare_guardian', {
    household_id: householdId,
    version: GUARDIAN_DECLARATION_VERSION,
    locale,
  });
  if (error) {
    const offline = !error.code && /fetch|network/i.test(error.message ?? '');
    throw new Error(offline ? 'offline' : 'unknown');
  }
}
