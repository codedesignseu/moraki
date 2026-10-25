import type {
  ExportAccount,
  ExportConsent,
  ExportConsentEvent,
  ExportFeedback,
} from '@/domain/export/exportHousehold';

import type { Auth } from './auth';

type ConsentRow = { policy_version: string; granted_at: string; withdrawn_at: string | null };
type ConsentEventRow = {
  purpose: string;
  version: string;
  action: string;
  text_key: string;
  locale: string | null;
  household_id: string | null;
  baby_id: string | null;
  created_at: string;
};
type FeedbackRow = {
  kind: string;
  message: string;
  app_version: string | null;
  platform: string | null;
  locale: string | null;
  created_at: string;
};

const ms = (at: string) => Date.parse(at);

/**
 * What the server holds about the signed-in person that is not the
 * household's (legal review P0.10): their consent rows, their consent history
 * where the server keeps one, and the feedback they sent. Read as them, so
 * row level security returns their own rows and nothing else.
 *
 * Asked only when someone taps export, never to render a screen (rule 1).
 * Null when any required read fails: the export then says the records were
 * unavailable instead of implying there are none.
 */
export async function fetchAccountRecords(
  auth: Auth,
  userId: string,
): Promise<ExportAccount['records']> {
  try {
    const [consents, history, feedback] = await Promise.all([
      auth.client
        .from('consents')
        .select('policy_version, granted_at, withdrawn_at')
        .eq('user_id', userId),
      auth.client
        .from('consent_events')
        .select('purpose, version, action, text_key, locale, household_id, baby_id, created_at')
        .eq('user_id', userId),
      auth.client
        .from('feedback')
        .select('kind, message, app_version, platform, locale, created_at')
        .eq('user_id', userId),
    ]);
    if (consents.error || feedback.error) return null;
    return {
      consents: (consents.data as ConsentRow[]).map((row): ExportConsent => ({
        policyVersion: row.policy_version,
        grantedAt: ms(row.granted_at),
        withdrawnAt: row.withdrawn_at === null ? null : ms(row.withdrawn_at),
      })),
      // A server without the consent history table answers with an error:
      // that means there is no history to include, not that the export failed.
      consentEvents: history.error
        ? null
        : (history.data as ConsentEventRow[]).map((row): ExportConsentEvent => ({
            purpose: row.purpose,
            version: row.version,
            action: row.action,
            textKey: row.text_key,
            locale: row.locale,
            householdId: row.household_id,
            babyId: row.baby_id,
            at: ms(row.created_at),
          })),
      feedback: (feedback.data as FeedbackRow[]).map((row): ExportFeedback => ({
        kind: row.kind,
        message: row.message,
        appVersion: row.app_version,
        platform: row.platform,
        locale: row.locale,
        sentAt: ms(row.created_at),
      })),
    };
  } catch {
    return null;
  }
}
