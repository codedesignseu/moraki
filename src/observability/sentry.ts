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
 * - sessions (release health): a ping per app start with a per-install id,
 *   which is usage tracking, not crash reporting (P1.1).
 * - client reports: counts of dropped events, which nobody here reads.
 * - screenshots, view hierarchies, replays, logs and profiles: each one is the
 *   screen's content or a trace of it.
 *
 * What the scrubbers can't reach (P1.1, assessment Q148). The native SDKs
 * never see `beforeSend` (the RN wrapper strips it before starting them), so
 * anything a native SDK captures itself goes out unscrubbed. Hence:
 * - native breadcrumbs are off (network requests with their URLs, lifecycle,
 *   system events): only JS breadcrumbs remain, and those pass
 *   `scrubBreadcrumb` before they are copied to the native scope.
 * - iOS app hangs and watchdog terminations are off: they are native events
 *   and they aren't crashes.
 * - native crashes stay on, deliberately. They carry a stack trace, the
 *   device and OS context the native SDK adds, and the already-scrubbed JS
 *   breadcrumbs and tags. Android ANRs come with them: the RN SDK can't turn
 *   one off without the other. What's left is covered by Sentry's server-side
 *   scrubbing (docs/compliance/processors.md).
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
    profilesSampleRate: 0,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
    enableAutoSessionTracking: false,
    sendClientReports: false,
    enableLogs: false,
    attachScreenshot: false,
    attachViewHierarchy: false,
    // Native-only data, which `beforeSend` never sees (see above).
    enableAppHangTracking: false,
    enableWatchdogTerminationTracking: false,
    enableMetricKit: false,
    enableNativeFramesTracking: false,
    enableStallTracking: false,
    enableAppStartTracking: false,
    enableUserInteractionTracing: false,
    enableNetworkBreadcrumbs: false,
    enableNetworkEventBreadcrumbs: false,
    enableAutoBreadcrumbTracking: false,
    enableActivityLifecycleBreadcrumbs: false,
    enableAppLifecycleBreadcrumbs: false,
    enableSystemEventBreadcrumbs: false,
    enableAppComponentBreadcrumbs: false,
    // Crashes are the point: kept on, native ones included.
    enableNative: true,
    enableNativeCrashHandling: true,
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
