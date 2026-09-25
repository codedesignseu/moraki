/**
 * What is allowed to leave the phone in a crash report (P4-08, CLAUDE.md
 * rule 8: no health data in logs, Sentry events or analytics).
 *
 * Crash reporting is built the other way round from how it usually is: nothing
 * ships unless it is named here. A Sentry event that arrives with fields this
 * app has never heard of loses them, so a future SDK version cannot widen what
 * is sent by adding a field.
 *
 * These are plain functions over plain objects. They are the whole policy, and
 * they are tested against events shaped like the ones that actually go wrong:
 * a failed SQLite write carrying its statement, a zod error carrying a note, a
 * console breadcrumb holding a whole payload.
 */

/** As much of a Sentry event as this app will look at. Everything else is dropped. */
export type LooseEvent = {
  event_id?: string;
  timestamp?: number | string;
  platform?: string;
  level?: string;
  logger?: string;
  release?: string;
  dist?: string;
  environment?: string;
  message?: unknown;
  exception?: { values?: LooseException[] };
  breadcrumbs?: LooseBreadcrumb[] | { values?: LooseBreadcrumb[] };
  contexts?: Record<string, unknown>;
  tags?: Record<string, unknown>;
  sdk?: unknown;
  [key: string]: unknown;
};

type LooseException = {
  type?: string;
  value?: unknown;
  mechanism?: unknown;
  stacktrace?: { frames?: LooseFrame[] };
  [key: string]: unknown;
};

type LooseFrame = {
  filename?: string;
  function?: string;
  lineno?: number;
  colno?: number;
  in_app?: boolean;
  [key: string]: unknown;
};

export type LooseBreadcrumb = {
  type?: string;
  category?: string;
  level?: string;
  message?: unknown;
  timestamp?: number;
  data?: unknown;
  [key: string]: unknown;
};

/**
 * Contexts that describe the phone and the build, never the family. `app`,
 * `device` and `os` are what makes a stack trace worth reading; `response` and
 * `state` (a serialised store) are exactly what must not travel.
 */
const CONTEXTS_ALLOWED = new Set(['app', 'device', 'os', 'runtime', 'culture']);

/**
 * Breadcrumb categories worth keeping. A navigation crumb says which screen
 * someone was on, which is how a crash is reproduced; its `data` holds route
 * params (an entry id), so the data goes and the category stays.
 *
 * Everything else is dropped by default, and the two that matter most are
 * `console` (the app's own logs) and `xhr`/`fetch` (request bodies: an entry's
 * payload on its way to push_events).
 */
const BREADCRUMBS_ALLOWED = new Set(['navigation', 'app.lifecycle', 'sentry.event']);

const MAX_TEXT = 300;

/**
 * Text as it may be sent: no address, no id, no quoted literal and no JSON.
 * A SQLite error quotes the statement it failed on, and a statement can carry
 * a note or a temperature, so quoted runs go whatever they hold.
 */
export function redactText(input: unknown): string | undefined {
  if (typeof input !== 'string') return undefined;
  const redacted = input
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '[email]')
    .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, '[id]')
    .replace(/\{[^{}]*\}/g, '[object]')
    .replace(/\[[^[\]]*\]/g, (match) =>
      /^\[(email|id|object|redacted)\]$/.test(match) ? match : '[list]',
    )
    .replace(/'[^']{1,}'/g, "'[redacted]'")
    .replace(/"[^"]{1,}"/g, '"[redacted]"');
  return redacted.length > MAX_TEXT ? `${redacted.slice(0, MAX_TEXT)}…` : redacted;
}

/** A stack frame with its code and its variables left behind. */
function scrubFrame(frame: LooseFrame): LooseFrame {
  return {
    ...(frame.filename === undefined ? {} : { filename: frame.filename }),
    ...(frame.function === undefined ? {} : { function: frame.function }),
    ...(frame.lineno === undefined ? {} : { lineno: frame.lineno }),
    ...(frame.colno === undefined ? {} : { colno: frame.colno }),
    ...(frame.in_app === undefined ? {} : { in_app: frame.in_app }),
  };
}

function scrubException(value: LooseException): LooseException {
  const text = redactText(value.value);
  return {
    ...(value.type === undefined ? {} : { type: value.type }),
    ...(text === undefined ? {} : { value: text }),
    ...(value.mechanism === undefined ? {} : { mechanism: value.mechanism }),
    ...(value.stacktrace?.frames
      ? { stacktrace: { frames: value.stacktrace.frames.map(scrubFrame) } }
      : {}),
  };
}

/**
 * One breadcrumb, or null to drop it. Sentry's `beforeBreadcrumb` takes null
 * as "never mind", which is the right answer for most of them.
 */
export function scrubBreadcrumb(crumb: LooseBreadcrumb | null): LooseBreadcrumb | null {
  if (!crumb) return null;
  if (!crumb.category || !BREADCRUMBS_ALLOWED.has(crumb.category)) return null;
  const message = redactText(crumb.message);
  return {
    category: crumb.category,
    ...(crumb.type === undefined ? {} : { type: crumb.type }),
    ...(crumb.level === undefined ? {} : { level: crumb.level }),
    ...(crumb.timestamp === undefined ? {} : { timestamp: crumb.timestamp }),
    ...(message === undefined ? {} : { message }),
    // No data: route params, request bodies and response payloads all live here.
  };
}

/**
 * One event, allow-listed field by field. Never returns null: a report that
 * survives this carries a stack trace and the build it came from, which is
 * what crash reporting is for.
 */
export function scrubEvent(event: LooseEvent): LooseEvent {
  const crumbs = Array.isArray(event.breadcrumbs) ? event.breadcrumbs : event.breadcrumbs?.values;
  const contexts = Object.entries(event.contexts ?? {}).filter(([name]) =>
    CONTEXTS_ALLOWED.has(name),
  );
  const message = redactText(
    typeof event.message === 'object' && event.message !== null
      ? (event.message as { message?: unknown }).message
      : event.message,
  );

  return {
    ...(event.event_id === undefined ? {} : { event_id: event.event_id }),
    ...(event.timestamp === undefined ? {} : { timestamp: event.timestamp }),
    ...(event.platform === undefined ? {} : { platform: event.platform }),
    ...(event.level === undefined ? {} : { level: event.level }),
    ...(event.logger === undefined ? {} : { logger: event.logger }),
    ...(event.release === undefined ? {} : { release: event.release }),
    ...(event.dist === undefined ? {} : { dist: event.dist }),
    ...(event.environment === undefined ? {} : { environment: event.environment }),
    ...(event.sdk === undefined ? {} : { sdk: event.sdk }),
    ...(message === undefined ? {} : { message }),
    ...(event.exception?.values
      ? { exception: { values: event.exception.values.map(scrubException) } }
      : {}),
    ...(crumbs
      ? {
          breadcrumbs: crumbs
            .map(scrubBreadcrumb)
            .filter((crumb): crumb is LooseBreadcrumb => crumb !== null),
        }
      : {}),
    ...(contexts.length > 0 ? { contexts: Object.fromEntries(contexts) } : {}),
    // Tags are ours: they are set in code, so none of them is user content.
    ...(event.tags === undefined ? {} : { tags: event.tags }),
  };
}
