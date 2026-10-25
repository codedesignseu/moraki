// Supabase Edge Function (Deno): emails the inactivity warnings queued by
// warn_inactive_households(), through Brevo.
//
// Called once a day by pg_cron (request_inactivity_warnings(), via pg_net)
// with the shared secret in the x-moraki-cron-secret header; deployed with
// verify_jwt off (supabase/config.toml), so that header is the only way in.
// Reads the queue with the service role, which only the Edge Runtime holds.
//
// Answers { sent, failed, errors, stopped }. Logs the same counts and failure
// codes, never an address, a body or Brevo's answer.
//
// Secrets (set by the owner, see docs/10-release-runbook.md):
//   BREVO_API_KEY, INACTIVITY_WARNINGS_CRON_SECRET
import { createClient } from 'jsr:@supabase/supabase-js@2.117.0';

import {
  CRON_SECRET_HEADER,
  type ClaimedWarning,
  isAuthorized,
  readConfig,
  runWarnings,
  sendWarning,
} from './warning.ts';

const json = (status: number, value: unknown) =>
  new Response(JSON.stringify(value), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

Deno.serve(async (request) => {
  if (request.method !== 'POST') return json(405, { error: 'method_not_allowed' });

  const config = readConfig((name) => Deno.env.get(name));
  if (!config) {
    console.error('send-inactivity-warnings: secrets are not set');
    return json(500, { error: 'not_configured' });
  }
  if (!isAuthorized(request.headers.get(CRON_SECRET_HEADER), config.cronSecret)) {
    return json(401, { error: 'unauthorized' });
  }

  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) return json(500, { error: 'not_configured' });
  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    const summary = await runWarnings({
      claim: async (max) => {
        const { data, error } = await supabase.rpc('claim_inactivity_warnings', { max_rows: max });
        if (error) throw new Error('claim_failed');
        return (data ?? []) as ClaimedWarning[];
      },
      finish: async (warningId, sent) => {
        const { error } = await supabase.rpc('finish_inactivity_warning', {
          warning_id: warningId,
          was_sent: sent,
        });
        if (error) throw new Error('finish_failed');
      },
      // No account stores a language yet, so every email is English and Greek.
      send: (row) => sendWarning(fetch, config.brevoApiKey, row.email, row.delete_on, null),
    });
    console.log(`send-inactivity-warnings: ${JSON.stringify(summary)}`);
    return json(200, summary);
  } catch (error) {
    // Our own error codes only; a database error message could quote a row.
    const code =
      error instanceof Error && /^(claim|finish)_failed$/.test(error.message)
        ? error.message
        : 'unexpected';
    console.error(`send-inactivity-warnings: ${code}`);
    return json(500, { error: code });
  }
});
