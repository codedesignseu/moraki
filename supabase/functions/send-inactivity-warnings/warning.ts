/**
 * The inactivity warning email (owner decision 2026-10-24): composing it and
 * handing it to Brevo's transactional email API.
 *
 * Pure apart from what is passed in (`fetch`, the claim and finish calls), so
 * it runs under Deno in the Edge Function and under Jest in the app's test
 * run. Nothing here logs, and nothing it returns carries an address or a
 * body: only counts and failure codes leave these functions.
 *
 * The copy is here, not in src/i18n, because the Edge Function is deployed on
 * its own and cannot import the app's bundle. It names no baby and no health
 * data (rules 8 and 10): only that the household is unused and the date.
 */

export const BREVO_URL = 'https://api.brevo.com/v3/smtp/email';
export const SENDER = { name: 'Moraki', email: 'hello@moraki.app' } as const;
/** The header pg_cron sends the shared secret in. */
export const CRON_SECRET_HEADER = 'x-moraki-cron-secret';
/** How many emails one claim asks for, and how many claims one run makes at most. */
export const BATCH_SIZE = 50;
export const MAX_BATCHES = 10;

export type Locale = 'en' | 'el';

export type WarningConfig = {
  brevoApiKey: string;
  cronSecret: string;
};

/** Reads the two secrets from the environment; null if either is missing or blank. */
export function readConfig(get: (name: string) => string | undefined): WarningConfig | null {
  const brevoApiKey = get('BREVO_API_KEY')?.trim();
  const cronSecret = get('INACTIVITY_WARNINGS_CRON_SECRET')?.trim();
  if (!brevoApiKey || !cronSecret) return null;
  return { brevoApiKey, cronSecret };
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

const MONTHS: Record<Locale, readonly string[]> = {
  en: [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ],
  // Genitive, as a date is written: "24 Νοεμβρίου 2026".
  el: [
    'Ιανουαρίου',
    'Φεβρουαρίου',
    'Μαρτίου',
    'Απριλίου',
    'Μαΐου',
    'Ιουνίου',
    'Ιουλίου',
    'Αυγούστου',
    'Σεπτεμβρίου',
    'Οκτωβρίου',
    'Νοεμβρίου',
    'Δεκεμβρίου',
  ],
};

/** `2026-11-24` → "24 November 2026" or "24 Νοεμβρίου 2026". Null if not a date. */
export function formatDate(isoDate: string, locale: Locale): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!match) return null;
  const [, year, month, day] = match as unknown as [string, string, string, string];
  const name = MONTHS[locale][Number(month) - 1];
  const dayNumber = Number(day);
  if (!name || dayNumber < 1 || dayNumber > 31) return null;
  return `${dayNumber} ${name} ${year}`;
}

const COPY: Record<Locale, { subject: string; body: (date: string) => string }> = {
  en: {
    subject: 'Your Moraki household will be deleted in 30 days',
    body: (date) =>
      [
        'No one has used your Moraki household for almost two years.',
        '',
        `To keep your data, open Moraki on any phone in the household before ${date}. If you do nothing, the household and its entries will be deleted on that date.`,
        '',
        'You can also export your data first in Settings → Data export.',
        '',
        '— Moraki, a product of C.E. CODE DESIGNS LTD · moraki.app/privacy',
      ].join('\n'),
  },
  el: {
    subject: 'Το νοικοκυριό σου στο Moraki θα διαγραφεί σε 30 ημέρες',
    body: (date) =>
      [
        'Κανείς δεν έχει χρησιμοποιήσει το νοικοκυριό σου στο Moraki εδώ και σχεδόν δύο χρόνια.',
        '',
        `Για να κρατήσεις τα δεδομένα σου, άνοιξε το Moraki σε οποιοδήποτε κινητό του νοικοκυριού πριν από τις ${date}. Αν δεν κάνεις τίποτα, το νοικοκυριό και οι καταχωρίσεις του θα διαγραφούν εκείνη την ημέρα.`,
        '',
        'Μπορείς επίσης να εξάγεις πρώτα τα δεδομένα σου από τις Ρυθμίσεις → Εξαγωγή δεδομένων.',
        '',
        '— Moraki, ένα προϊόν της C.E. CODE DESIGNS LTD · moraki.app/el/privacy',
      ].join('\n'),
  },
};

export type WarningEmail = { subject: string; text: string };

/**
 * The email for one member. With a known locale, in that language; without
 * one (no account stores a language today), English then Greek in one email.
 */
export function composeWarning(deleteOn: string, locale: Locale | null): WarningEmail | null {
  const en = formatDate(deleteOn, 'en');
  const el = formatDate(deleteOn, 'el');
  if (!en || !el) return null;
  if (locale === 'en') return { subject: COPY.en.subject, text: COPY.en.body(en) };
  if (locale === 'el') return { subject: COPY.el.subject, text: COPY.el.body(el) };
  return {
    subject: `${COPY.en.subject} · ${COPY.el.subject}`,
    text: `${COPY.en.body(en)}\n\n— — —\n\n${COPY.el.body(el)}`,
  };
}

/** The Brevo request for one email: plain text, one recipient, no tracking links. */
export function buildBrevoRequest(
  apiKey: string,
  to: string,
  email: WarningEmail,
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
        tags: ['inactivity-warning'],
      }),
    },
  };
}

/** Why Brevo did not take an email, without anything from its answer. */
export type SendFailure =
  | 'bad_row' // the claimed row had no usable address or date
  | 'brevo_rejected' // 4xx other than below: this email, e.g. an address Brevo refuses
  | 'brevo_unauthorized' // 401/403: the key is wrong or the sender is not allowed
  | 'brevo_rate_limited' // 429
  | 'brevo_unavailable' // 5xx
  | 'brevo_unreachable'; // no answer

export type SendResult = { sent: true } | { sent: false; error: SendFailure };

export async function sendWarning(
  fetchImpl: typeof fetch,
  apiKey: string,
  to: string,
  deleteOn: string,
  locale: Locale | null,
): Promise<SendResult> {
  const email = composeWarning(deleteOn, locale);
  if (!email || !to.includes('@')) return { sent: false, error: 'bad_row' };
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

/** One row from `claim_inactivity_warnings`. */
export type ClaimedWarning = { warning_id: number; email: string; delete_on: string };

export type RunDeps = {
  claim: (max: number) => Promise<ClaimedWarning[]>;
  finish: (warningId: number, sent: boolean) => Promise<void>;
  send: (row: ClaimedWarning) => Promise<SendResult>;
};

export type RunSummary = {
  sent: number;
  failed: number;
  /** Failure codes and how often each came up. Never an address. */
  errors: Partial<Record<SendFailure, number>>;
  /** True if the run stopped early because Brevo refused the key or the sender. */
  stopped: boolean;
};

/**
 * Claims and sends batches until the queue is empty or MAX_BATCHES is reached.
 * A sent row is finished as sent at once. A refused one is released only when
 * the run ends, so the same run never claims it again; the next day's run
 * does. On 401/403 or 429 the rest of the batch is released untried and the
 * run stops, since every other email would fail the same way.
 */
export async function runWarnings(deps: RunDeps): Promise<RunSummary> {
  const summary: RunSummary = { sent: 0, failed: 0, errors: {}, stopped: false };
  const release: number[] = [];
  for (let batch = 0; batch < MAX_BATCHES && !summary.stopped; batch += 1) {
    const rows = await deps.claim(BATCH_SIZE);
    for (const row of rows) {
      if (summary.stopped) {
        release.push(row.warning_id);
        continue;
      }
      const result = await deps.send(row);
      if (result.sent) {
        await deps.finish(row.warning_id, true);
        summary.sent += 1;
        continue;
      }
      release.push(row.warning_id);
      summary.failed += 1;
      summary.errors[result.error] = (summary.errors[result.error] ?? 0) + 1;
      if (result.error === 'brevo_unauthorized' || result.error === 'brevo_rate_limited') {
        summary.stopped = true;
      }
    }
    if (rows.length < BATCH_SIZE) break;
  }
  for (const id of release) await deps.finish(id, false);
  return summary;
}
