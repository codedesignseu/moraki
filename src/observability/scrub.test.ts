import { redactText, scrubBreadcrumb, scrubEvent, type LooseEvent } from './scrub';

/**
 * CLAUDE.md rule 8: no health data in logs, Sentry events or analytics. The
 * events below are shaped like the ones that actually go wrong, so each test
 * says which real crash it stands for.
 */

/** Every string anywhere in an object, however deep. */
function everyString(value: unknown, found: string[] = []): string[] {
  if (typeof value === 'string') found.push(value);
  else if (Array.isArray(value)) for (const item of value) everyString(item, found);
  else if (value && typeof value === 'object') {
    for (const [key, inner] of Object.entries(value)) {
      found.push(key);
      everyString(inner, found);
    }
  }
  return found;
}

const mentions = (event: unknown, text: string) =>
  everyString(event).some((found) => found.includes(text));

describe('redacting text', () => {
  it('keeps the shape of an error and loses what it quotes', () => {
    expect(redactText("SQLite error: near 'Slept badly, warm at 3am': syntax error")).toBe(
      "SQLite error: near '[redacted]': syntax error",
    );
  });

  it('loses an email address and an id', () => {
    expect(redactText('no rows for parent@example.test')).toBe('no rows for [email]');
    expect(redactText('household 0190a0b0-0000-7000-8000-0000000000a1 not found')).toBe(
      'household [id] not found',
    );
  });

  it('loses a JSON payload whole', () => {
    expect(redactText('invalid payload {"ml":90,"milk":"breast"} rejected')).toBe(
      'invalid payload [object] rejected',
    );
  });

  it('caps the length, so a dumped database row cannot travel', () => {
    const long = redactText(`error ${'x'.repeat(5_000)}`);
    expect(long?.length).toBe(301);
    expect(long?.endsWith('…')).toBe(true);
  });

  it('ignores anything that is not text', () => {
    expect(redactText(undefined)).toBeUndefined();
    expect(redactText({ ml: 90 })).toBeUndefined();
  });
});

describe('scrubbing a breadcrumb', () => {
  it("drops the app's own console logs, whatever they hold", () => {
    expect(
      scrubBreadcrumb({
        category: 'console',
        level: 'log',
        message: '[sync] pushing {"type":"health","payload":{"temp_c":38.1}}',
      }),
    ).toBeNull();
  });

  it('drops a request crumb, which is where a payload travels', () => {
    expect(
      scrubBreadcrumb({
        category: 'xhr',
        data: { url: 'https://example.test/rest/v1/rpc/push_events', body: '{"ops":[]}' },
      }),
    ).toBeNull();
  });

  it('keeps which screen someone was on, and not the route params', () => {
    const crumb = scrubBreadcrumb({
      category: 'navigation',
      level: 'info',
      timestamp: 1,
      message: 'entry/[id]',
      data: { from: '/(tabs)', to: '/entry/0190a0b0-0000-7000-8000-0000000000a1' },
    });
    expect(crumb).toEqual({
      category: 'navigation',
      level: 'info',
      timestamp: 1,
      message: 'entry/[id]',
    });
  });

  it('drops a crumb with no category rather than guessing', () => {
    expect(scrubBreadcrumb({ message: 'something happened' })).toBeNull();
    expect(scrubBreadcrumb(null)).toBeNull();
  });
});

describe('scrubbing an event', () => {
  /** A failed write: the statement it failed on carries the note that was typed. */
  const failedWrite: LooseEvent = {
    event_id: 'abc',
    level: 'error',
    release: 'eu.codedesigns.moraki@0.1.0',
    platform: 'android',
    exception: {
      values: [
        {
          type: 'SQLiteError',
          value: "cannot commit: insert into events values ('Rash on her back, 38.1')",
          stacktrace: {
            frames: [
              {
                filename: 'src/db/repositories/events.ts',
                function: 'insert',
                lineno: 84,
                in_app: true,
                // Sentry can be configured to attach locals; they would hold the payload.
                vars: { payload: { note: 'Rash on her back', temp_c: 38.1 } },
                pre_context: ["  const row = { note: 'Rash on her back' };"],
              },
            ],
          },
        },
      ],
    },
    user: { id: 'user-1', email: 'parent@example.test', ip_address: '203.0.113.4' },
    request: {
      url: 'https://example.test/rest/v1/events?household_id=eq.0190a0b0',
      headers: { Authorization: 'Bearer token' },
    },
    extra: { lastEntry: { type: 'health', payload: { temp_c: 38.1 } } },
    contexts: {
      app: { app_version: '0.1.0' },
      device: { model: 'Pixel 7' },
      os: { name: 'Android' },
      state: { state: { entries: [{ note: 'Rash on her back' }] } },
      response: { body: '{"note":"Rash on her back"}' },
    },
    breadcrumbs: [
      { category: 'console', message: 'saving {"temp_c":38.1}' },
      { category: 'navigation', message: 'log/health', data: { to: '/log/health' } },
      { category: 'touch', message: 'Text(Rash on her back)' },
    ],
    tags: { 'moraki.build': 'preview' },
  };

  const clean = scrubEvent(failedWrite);

  it('keeps the crash: what broke, where, and in which build', () => {
    expect(clean.level).toBe('error');
    expect(clean.release).toBe('eu.codedesigns.moraki@0.1.0');
    expect(clean.exception?.values?.[0]?.type).toBe('SQLiteError');
    expect(clean.exception?.values?.[0]?.stacktrace?.frames?.[0]).toEqual({
      filename: 'src/db/repositories/events.ts',
      function: 'insert',
      lineno: 84,
      in_app: true,
    });
    expect(clean.tags).toEqual({ 'moraki.build': 'preview' });
    expect(clean.contexts).toEqual({
      app: { app_version: '0.1.0' },
      device: { model: 'Pixel 7' },
      os: { name: 'Android' },
    });
  });

  it('carries nothing the family typed, from any field at any depth', () => {
    expect(mentions(clean, 'Rash on her back')).toBe(false);
    expect(mentions(clean, '38.1')).toBe(false);
    expect(mentions(clean, 'parent@example.test')).toBe(false);
    expect(mentions(clean, '203.0.113.4')).toBe(false);
    expect(mentions(clean, 'Bearer')).toBe(false);
  });

  it('drops whole fields that exist to carry content', () => {
    for (const field of ['user', 'request', 'extra', 'server_name', 'modules']) {
      expect(clean[field]).toBeUndefined();
    }
    expect(clean.contexts?.state).toBeUndefined();
    expect(clean.contexts?.response).toBeUndefined();
  });

  it('keeps only the breadcrumbs that say where someone was', () => {
    expect(clean.breadcrumbs).toEqual([{ category: 'navigation', message: 'log/health' }]);
  });

  it('drops a field it has never heard of, so a new SDK cannot widen this', () => {
    const scrubbed = scrubEvent({
      level: 'error',
      some_future_field: { note: 'Rash on her back' },
    });
    expect(scrubbed.some_future_field).toBeUndefined();
    expect(mentions(scrubbed, 'Rash on her back')).toBe(false);
  });

  it('redacts a message, wherever the SDK put it', () => {
    expect(scrubEvent({ message: "failed on 'Slept 4h'" }).message).toBe("failed on '[redacted]'");
    expect(scrubEvent({ message: { message: "failed on 'Slept 4h'" } }).message).toBe(
      "failed on '[redacted]'",
    );
  });

  it('reads breadcrumbs whether the SDK wraps them or not', () => {
    const wrapped = scrubEvent({
      breadcrumbs: { values: [{ category: 'navigation', message: 'log/feed' }] },
    });
    expect(wrapped.breadcrumbs).toEqual([{ category: 'navigation', message: 'log/feed' }]);
  });
});
