import { PRIVACY_VERSION, TERMS_VERSION, type ConsentLocale } from '@/domain/consent/consent';

import type { Auth } from './auth';

/**
 * Records, as the signed-in account, agreeing to the Terms of Use in force
 * (P0.9) through `record_consent`. The text key also names the Privacy
 * Policy version that was linked next to it.
 */
export async function recordTerms(auth: Auth, locale: ConsentLocale): Promise<void> {
  const { error } = await auth.client.rpc('record_consent', {
    purpose: 'terms',
    version: TERMS_VERSION,
    action: 'grant',
    locale,
    text_key: `terms;privacy=${PRIVACY_VERSION}`,
  });
  if (error) {
    const offline = !error.code && /fetch|network/i.test(error.message ?? '');
    throw new Error(offline ? 'offline' : 'unknown');
  }
}

/**
 * Whether the server has this account agreeing to the Terms in force: a
 * consent_events row of its own (RLS shows nobody else's). Null when the
 * server couldn't be asked.
 */
export async function termsOnRecord(auth: Auth, userId: string): Promise<boolean | null> {
  try {
    const { data, error } = await auth.client
      .from('consent_events')
      .select('id')
      .eq('user_id', userId)
      .eq('purpose', 'terms')
      .eq('version', TERMS_VERSION)
      .eq('action', 'grant')
      .limit(1);
    if (error || !Array.isArray(data)) return null;
    return data.length > 0;
  } catch {
    return null;
  }
}
