import * as Sentry from '@sentry/react-native';

import { readSentrySettings, type SentrySettings } from './dsn';
import { scrubBreadcrumb, scrubEvent, type LooseBreadcrumb, type LooseEvent } from './scrub';

/**
 * Crash reporting (P4-08). Off unless the build carries an EU DSN, and even
 * then it sends stack traces and the build's own details, nothing else: every
 * event goes through `scrubEvent` and every breadcrumb through
 * `scrubBreadcrumb`, which allow-list rather than blocklist.
 *
 * What is deliberately turned off, each because it would carry content:
 * - `sendDefaultPii`: the IP address and the device name.
 * - failed request capture: a URL, its headers and its body — an entry's
 *   payload on its way to the server.
 * - performance tracing: a span per request, so the same again.
 * - user context: Sentry is never told who is signed in.
 */
export function startCrashReporting(
  settings: SentrySettings | null = readSentrySettings(),
): boolean {
  if (!settings) return false;

  Sentry.init({
    dsn: settings.dsn,
    environment: settings.environment,
    sendDefaultPii: false,
    enableCaptureFailedRequests: false,
    enableAutoPerformanceTracing: false,
    tracesSampleRate: 0,
    // A crash is worth the last few steps, not the last hundred.
    maxBreadcrumbs: 20,
    // The scrubbers work on plain objects on purpose: they are the policy, and
    // they must not change shape when the SDK's own types do. Both casts go
    // through `unknown`, because an allow-listed event is deliberately not the
    // same shape as the one that came in.
    beforeSend: (event) => scrubEvent(event as unknown as LooseEvent) as unknown as typeof event,
    beforeBreadcrumb: (crumb) =>
      scrubBreadcrumb(crumb as unknown as LooseBreadcrumb) as unknown as typeof crumb | null,
  });
  // Nothing about the person, ever. Set explicitly so a future default can't
  // start attaching an id or an email.
  Sentry.setUser(null);
  return true;
}
