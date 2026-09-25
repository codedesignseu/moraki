export type SentrySettings = {
  dsn: string;
  environment: string;
};

export class SentryEnvError extends Error {
  override name = 'SentryEnvError';
}

/**
 * Sentry's EU region ingests on `*.ingest.de.sentry.io`. SDD 12.1 keeps every
 * processor in the EU, and a DSN is the one place that choice is visible, so it
 * is checked here rather than trusted to whoever pasted it in.
 */
const EU_INGEST = /\.ingest\.de\.sentry\.io$/;

/**
 * Reads the crash reporting settings, or returns null when there is no DSN.
 * Null is a normal state, not a failure: a build with no DSN reports nothing,
 * which is what every local and test build does.
 *
 * A DSN pointing anywhere but the EU throws. Better a build that refuses to
 * start than one quietly shipping crash reports to Virginia.
 */
export function parseSentrySettings(env: {
  EXPO_PUBLIC_SENTRY_DSN?: string | undefined;
  EXPO_PUBLIC_SENTRY_ENV?: string | undefined;
}): SentrySettings | null {
  const dsn = env.EXPO_PUBLIC_SENTRY_DSN?.trim();
  if (!dsn) return null;

  let host: string;
  try {
    host = new URL(dsn).hostname;
  } catch {
    throw new SentryEnvError('EXPO_PUBLIC_SENTRY_DSN is not a URL. See .env.example.');
  }
  if (!EU_INGEST.test(host)) {
    throw new SentryEnvError(
      'EXPO_PUBLIC_SENTRY_DSN is not an EU project (expected an *.ingest.de.sentry.io host). ' +
        'Moraki keeps every processor in the EU; make the project in the EU region instead.',
    );
  }
  return { dsn, environment: env.EXPO_PUBLIC_SENTRY_ENV?.trim() || 'production' };
}

/**
 * Expo only inlines `process.env.EXPO_PUBLIC_*` written out in full, so each
 * name appears here literally.
 */
export function readSentrySettings(): SentrySettings | null {
  return parseSentrySettings({
    EXPO_PUBLIC_SENTRY_DSN: process.env.EXPO_PUBLIC_SENTRY_DSN,
    EXPO_PUBLIC_SENTRY_ENV: process.env.EXPO_PUBLIC_SENTRY_ENV,
  });
}
