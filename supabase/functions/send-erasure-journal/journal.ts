/**
 * The erasure journal email (owner decision 2026-10-26): every night, each
 * whole UTC day of `public.erasure_log` not yet sent goes to the owner's
 * mailbox as a CSV, so the record of erasures survives a database restore
 * (docs/compliance/data-requests.md, section 7).
 *
 * Pure apart from what is passed in (`fetch`, the RPC calls), so it runs
 * under Deno in the Edge Function and under Jest in the app's test run.
 * Nothing here logs, and nothing it returns carries an id or an address:
 * only counts, days and failure codes leave these functions.
 *
 * The CSV holds four columns and nothing else: kind, the subject's uuid,
 * erased_at in UTC, and the reason. No name, no email, no household name, no
 * entry content. The copy is for the owner, not for users, so it is English
 * only and lives here: the function is deployed on its own.
 */

export const BREVO_URL = 'https://api.brevo.com/v3/smtp/email';
export const SENDER = { name: 'Moraki', email: 'hello@moraki.app' } as const;
/** The header pg_cron sends the shared secret in. */
export const CRON_SECRET_HEADER = 'x-moraki-cron-secret';
export const TAG = 'erasure-journal';
/** How many days one claim asks for at most (the log keeps 35). */
export const MAX_DAYS = 40;

export type JournalConfig = {
  brevoApiKey: string;
  cronSecret: string;
  /** The owner's mailbox. One address. */
  to: string;
};

const ONE_ADDRESS = /^[^\s@,;<>"]+@[^\s@,;<>"]+\.[^\s@,;<>"]+$/;

/** Reads the three secrets; null if any is missing, blank, or `to` is not one address. */
export function readConfig(get: (name: string) => string | undefined): JournalConfig | null {
  const brevoApiKey = get('BREVO_API_KEY')?.trim();
  const cronSecret = get('ERASURE_JOURNAL_CRON_SECRET')?.trim();
  const to = get('ERASURE_JOURNAL_TO')?.trim();
  if (!brevoApiKey || !cronSecret || !to || !ONE_ADDRESS.test(to)) return null;
  return { brevoApiKey, cronSecret, to };
}

/** Whether the request carries the shared secret. Compares in constant time. */
export function isAuthorized(header: string | null, secret: string): boolean {
  if (header === null || secret.length === 0) return false;
  const a = new TextEncoder().encode(header);
  const b = new TextEncoder().encode(secret);
  let diff = a.length ^ b.length;
  for (let i = 0; i < b.length; i += 1) diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
  return diff === 0;
}

/** One row of `erasure_journal_rows(day)`. */
export type JournalRow = {
  kind: string;
  subject_id: string;
  erased_at: string;
  reason: string;
};

/** One row of `claim_erasure_journal()`: a whole UTC day not yet sent. */
export type DueDay = { journal_day: string; entries: number };

const KINDS = new Set(['account', 'household', 'entry']);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const REASON = /^[a-z_]{1,40}$/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

export const CSV_HEADER = 'kind,subject_id,erased_at_utc,reason';

/** A row as one CSV line, or null if any field is not what the log holds. */
function csvLine(row: JournalRow): string | null {
  const id = row.subject_id.toLowerCase();
  if (!KINDS.has(row.kind) || !UUID.test(id) || !REASON.test(row.reason)) return null;
  const time = new Date(row.erased_at);
  if (Number.isNaN(time.getTime())) return null;
  return `${row.kind},${id},${time.toISOString()},${row.reason}`;
}

/**
 * The CSV of one day: a header and one line per row, CRLF as RFC 4180 has
 * it. Every field is checked, so nothing but these four plain values can get
 * in, and none needs quoting. Null if any row is malformed.
 */
export function toCsv(rows: readonly JournalRow[]): string | null {
  const lines = [CSV_HEADER];
  for (const row of rows) {
    const line = csvLine(row);
    if (line === null) return null;
    lines.push(line);
  }
  return `${lines.join('\r\n')}\r\n`;
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export type JournalEmail = {
  subject: string;
  text: string;
  filename: string;
  csv: string;
};

/** The email for one day: a count by kind in the body, the ids only in the CSV. */
export function composeJournal(day: string, rows: readonly JournalRow[]): JournalEmail | null {
  if (!DAY.test(day) || rows.length === 0) return null;
  const csv = toCsv(rows);
  if (csv === null) return null;
  const count = (kind: string) => rows.filter((r) => r.kind === kind).length;
  const text = [
    `Moraki erasure journal for ${day} (UTC).`,
    '',
    `${plural(rows.length, 'erasure was', 'erasures were')} logged that day: ${plural(count('account'), 'account', 'accounts')}, ${plural(count('household'), 'household', 'households')}, ${plural(count('entry'), 'entry', 'entries')}. The attached CSV lists each one: kind, id, erased_at (UTC) and reason.`,
    '',
    'If the database is ever restored from a backup, apply again every erasure in the journals dated on or after the day of that backup, before the app is reopened (docs/compliance/data-requests.md, section 7).',
    '',
    'Keep this email for at least 35 days. Do not forward it.',
  ].join('\n');
  return {
    subject: `Moraki erasure journal ${day}`,
    text,
    filename: `moraki-erasure-journal-${day}.csv`,
    csv,
  };
}

/** Base64 of an ASCII string (the CSV is ASCII only: toCsv checks every field). */
function base64(ascii: string): string {
  return btoa(ascii);
}

/** The Brevo request for one day: plain text to one address, the CSV attached. */
export function buildBrevoRequest(
  apiKey: string,
  to: string,
  email: JournalEmail,
): { url: string; init: RequestInit } {
  return {
    url: BREVO_URL,
    init: {
      method: 'POST',
      headers: {
        'api-key': apiKey,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        sender: SENDER,
        to: [{ email: to }],
        subject: email.subject,
        textContent: email.text,
        attachment: [{ name: email.filename, content: base64(email.csv) }],
        tags: [TAG],
      }),
    },
  };
}

/** Why Brevo did not take an email, without anything from its answer. */
export type SendFailure =
  | 'bad_row' // a row was not what the log holds, or the day was not a date
  | 'brevo_rejected' // 4xx other than below
  | 'brevo_unauthorized' // 401/403: the key is wrong or the sender is not allowed
  | 'brevo_rate_limited' // 429
  | 'brevo_unavailable' // 5xx
  | 'brevo_unreachable'; // no answer

export type SendResult = { sent: true } | { sent: false; error: SendFailure };

export async function sendJournal(
  fetchImpl: typeof fetch,
  apiKey: string,
  to: string,
  day: string,
  rows: readonly JournalRow[],
): Promise<SendResult> {
  const email = composeJournal(day, rows);
  if (!email) return { sent: false, error: 'bad_row' };
  const { url, init } = buildBrevoRequest(apiKey, to, email);
  let response: Response;
  try {
    response = await fetchImpl(url, init);
  } catch {
    return { sent: false, error: 'brevo_unreachable' };
  }
  if (response.status >= 200 && response.status < 300) return { sent: true };
  if (response.status === 401 || response.status === 403) {
    return { sent: false, error: 'brevo_unauthorized' };
  }
  if (response.status === 429) return { sent: false, error: 'brevo_rate_limited' };
  if (response.status >= 500) return { sent: false, error: 'brevo_unavailable' };
  return { sent: false, error: 'brevo_rejected' };
}

export type RunDeps = {
  claim: (maxDays: number) => Promise<DueDay[]>;
  rows: (day: string) => Promise<JournalRow[]>;
  /** Marks the day sent; false if it was not the next day due. */
  finish: (day: string) => Promise<boolean>;
  release: () => Promise<void>;
  send: (day: string, rows: JournalRow[]) => Promise<SendResult>;
};

export type RunSummary = {
  /** Days emailed. */
  sent: number;
  /** Days with nothing logged: marked done, no email. */
  skipped: number;
  /** Log rows emailed, over all days. */
  entries: number;
  /** The failure that stopped the run, if one did. The day is tried again next night. */
  error?: SendFailure;
};

/**
 * Sends the days due, oldest first. An empty day is marked done without an
 * email. A day is marked done only after Brevo took it; if it did not, the
 * run stops there, so no later day is marked before it and the next night
 * starts again from that day. The journal is always released at the end.
 */
export async function runJournal(deps: RunDeps): Promise<RunSummary> {
  const summary: RunSummary = { sent: 0, skipped: 0, entries: 0 };
  try {
    const days = await deps.claim(MAX_DAYS);
    for (const { journal_day: day, entries } of days) {
      const rows = entries > 0 ? await deps.rows(day) : [];
      if (rows.length === 0) {
        await deps.finish(day);
        summary.skipped += 1;
        continue;
      }
      const result = await deps.send(day, rows);
      if (!result.sent) {
        summary.error = result.error;
        break;
      }
      await deps.finish(day);
      summary.sent += 1;
      summary.entries += rows.length;
    }
  } finally {
    await deps.release();
  }
  return summary;
}
