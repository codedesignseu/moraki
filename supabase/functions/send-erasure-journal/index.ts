// Supabase Edge Function (Deno): emails each whole UTC day of erasure_log not
// yet sent to the owner's mailbox, as a CSV, through Brevo. journal.ts builds
// the email and runs the days.
//
// Called once a night by pg_cron (request_erasure_journal(), via pg_net) with
// the shared secret in the x-moraki-cron-secret header; deployed with
// verify_jwt off (supabase/config.toml), so that header is the only way in.
// Reads the log with the service role, which only the Edge Runtime holds.
//
// Answers { sent, skipped, entries, error? }. Logs the same counts and the
// failure code, never an id, the recipient, or Brevo's answer.
//
// Secrets (set by the owner, see docs/10-release-runbook.md):
//   BREVO_API_KEY (shared with send-inactivity-warnings),
//   ERASURE_JOURNAL_CRON_SECRET, ERASURE_JOURNAL_TO
import { createClient } from 'jsr:@supabase/supabase-js@2.117.0';

import {
  CRON_SECRET_HEADER,
  type DueDay,
  type JournalRow,
  isAuthorized,
  readConfig,
  runJournal,
  sendJournal,
} from './journal.ts';

const json = (status: number, value: unknown) =>
  new Response(JSON.stringify(value), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

Deno.serve(async (request) => {
  if (request.method !== 'POST') return json(405, { error: 'method_not_allowed' });

  const config = readConfig((name) => Deno.env.get(name));
  if (!config) {
    console.error('send-erasure-journal: secrets are not set');
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
    const summary = await runJournal({
      claim: async (maxDays) => {
        const { data, error } = await supabase.rpc('claim_erasure_journal', { max_days: maxDays });
        if (error) throw new Error('claim_failed');
        return (data ?? []) as DueDay[];
      },
      rows: async (day) => {
        const { data, error } = await supabase.rpc('erasure_journal_rows', { journal_day: day });
        if (error) throw new Error('rows_failed');
        return (data ?? []) as JournalRow[];
      },
      finish: async (day) => {
        const { data, error } = await supabase.rpc('finish_erasure_journal_day', {
          journal_day: day,
        });
        if (error) throw new Error('finish_failed');
        return data === true;
      },
      release: async () => {
        const { error } = await supabase.rpc('release_erasure_journal');
        if (error) throw new Error('release_failed');
      },
      send: (day, rows) => sendJournal(fetch, config.brevoApiKey, config.to, day, rows),
    });
    console.log(`send-erasure-journal: ${JSON.stringify(summary)}`);
    return json(200, summary);
  } catch (error) {
    // Our own error codes only; a database error message could quote a row.
    const code =
      error instanceof Error && /^(claim|rows|finish|release)_failed$/.test(error.message)
        ? error.message
        : 'unexpected';
    console.error(`send-erasure-journal: ${code}`);
    return json(500, { error: code });
  }
});
