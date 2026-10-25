import {
  BATCH_SIZE,
  BREVO_URL,
  buildBrevoRequest,
  composeWarning,
  formatDate,
  isAuthorized,
  readConfig,
  runWarnings,
  sendWarning,
  type ClaimedWarning,
  type SendResult,
} from './warning';

const respond = (status: number) => (async () => new Response('{}', { status })) as typeof fetch;

describe('the configuration', () => {
  it('needs both secrets', () => {
    const env: Record<string, string> = {
      BREVO_API_KEY: 'k',
      INACTIVITY_WARNINGS_CRON_SECRET: 's',
    };
    expect(readConfig((n) => env[n])).toEqual({ brevoApiKey: 'k', cronSecret: 's' });
    expect(readConfig((n) => (n === 'BREVO_API_KEY' ? 'k' : undefined))).toBeNull();
    expect(readConfig((n) => (n === 'BREVO_API_KEY' ? 'k' : ' '))).toBeNull();
  });

  it('lets in only the exact shared secret', () => {
    expect(isAuthorized('secret-1', 'secret-1')).toBe(true);
    expect(isAuthorized('secret-2', 'secret-1')).toBe(false);
    expect(isAuthorized('secret-1x', 'secret-1')).toBe(false);
    expect(isAuthorized('', 'secret-1')).toBe(false);
    expect(isAuthorized(null, 'secret-1')).toBe(false);
    expect(isAuthorized('', '')).toBe(false);
  });
});

describe('the date', () => {
  it('is written out in English and in Greek, in the genitive', () => {
    expect(formatDate('2026-11-24', 'en')).toBe('24 November 2026');
    expect(formatDate('2026-11-24', 'el')).toBe('24 Νοεμβρίου 2026');
    expect(formatDate('2027-05-01', 'el')).toBe('1 Μαΐου 2027');
  });

  it('refuses anything that is not a date', () => {
    expect(formatDate('2026-13-01', 'en')).toBeNull();
    expect(formatDate('24/11/2026', 'en')).toBeNull();
    expect(formatDate('', 'el')).toBeNull();
  });
});

describe('the email', () => {
  it('says the household goes on the date, in English', () => {
    const email = composeWarning('2026-11-24', 'en');
    expect(email?.subject).toBe('Your Moraki household will be deleted in 30 days');
    expect(email?.text).toContain(
      'open Moraki on any phone in the household before 24 November 2026. If you do nothing, the household and its entries will be deleted on that date.',
    );
    expect(email?.text).toContain('Settings → Data export');
    expect(email?.text).toContain('C.E. CODE DESIGNS LTD · moraki.app/privacy');
    expect(email?.text).not.toMatch(/[α-ω]/);
  });

  it('and in Greek', () => {
    const email = composeWarning('2026-11-24', 'el');
    expect(email?.subject).toBe('Το νοικοκυριό σου στο Moraki θα διαγραφεί σε 30 ημέρες');
    expect(email?.text).toContain('πριν από τις 24 Νοεμβρίου 2026');
    expect(email?.text).toContain('Ρυθμίσεις → Εξαγωγή δεδομένων');
    expect(email?.text).toContain('moraki.app/el/privacy');
  });

  it('is both, English first, when the language is not known', () => {
    const email = composeWarning('2026-11-24', null);
    expect(email?.subject).toBe(
      'Your Moraki household will be deleted in 30 days · Το νοικοκυριό σου στο Moraki θα διαγραφεί σε 30 ημέρες',
    );
    const text = email?.text ?? '';
    expect(text.indexOf('24 November 2026')).toBeGreaterThan(-1);
    expect(text.indexOf('24 Νοεμβρίου 2026')).toBeGreaterThan(text.indexOf('24 November 2026'));
  });

  it('carries nothing about the baby or its health', () => {
    const text = composeWarning('2026-11-24', null)?.text ?? '';
    expect(text).not.toMatch(/baby|feed|sleep|weight|diaper|μωρ|τάισμα|ύπνο|βάρος|πάνα/i);
  });

  it('is not built from a bad date', () => {
    expect(composeWarning('soon', null)).toBeNull();
  });
});

describe('the Brevo request', () => {
  it('posts plain text from hello@moraki.app to one address, with the key in api-key', () => {
    const { url, init } = buildBrevoRequest('KEY', 'a@example.test', { subject: 'S', text: 'T' });
    expect(url).toBe('https://api.brevo.com/v3/smtp/email');
    expect(url).toBe(BREVO_URL);
    expect(init.method).toBe('POST');
    expect(init.headers).toEqual({
      'api-key': 'KEY',
      'Content-Type': 'application/json',
      Accept: 'application/json',
    });
    expect(JSON.parse(init.body as string)).toEqual({
      sender: { name: 'Moraki', email: 'hello@moraki.app' },
      to: [{ email: 'a@example.test' }],
      subject: 'S',
      textContent: 'T',
      tags: ['inactivity-warning'],
    });
  });
});

describe('sending one', () => {
  it('is sent when Brevo answers 201', async () => {
    const calls: [string, RequestInit][] = [];
    const fetchImpl = (async (url: string, init: RequestInit) => {
      calls.push([url, init]);
      return new Response('{"messageId":"x"}', { status: 201 });
    }) as unknown as typeof fetch;
    await expect(
      sendWarning(fetchImpl, 'KEY', 'a@example.test', '2026-11-24', null),
    ).resolves.toEqual({
      sent: true,
    });
    expect(calls).toHaveLength(1);
  });

  it.each([
    [400, 'brevo_rejected'],
    [401, 'brevo_unauthorized'],
    [403, 'brevo_unauthorized'],
    [429, 'brevo_rate_limited'],
    [502, 'brevo_unavailable'],
  ])('answers %i with %s', async (status, error) => {
    await expect(
      sendWarning(respond(status), 'KEY', 'a@example.test', '2026-11-24', null),
    ).resolves.toEqual({ sent: false, error });
  });

  it('is unreachable when the request throws', async () => {
    const fetchImpl = (async () => {
      throw new Error('offline');
    }) as typeof fetch;
    await expect(
      sendWarning(fetchImpl, 'KEY', 'a@example.test', '2026-11-24', null),
    ).resolves.toEqual({
      sent: false,
      error: 'brevo_unreachable',
    });
  });

  it('never calls Brevo for a row without an address or a date', async () => {
    const fetchImpl = jest.fn() as unknown as typeof fetch;
    await expect(sendWarning(fetchImpl, 'KEY', '', '2026-11-24', null)).resolves.toEqual({
      sent: false,
      error: 'bad_row',
    });
    await expect(sendWarning(fetchImpl, 'KEY', 'a@example.test', 'x', null)).resolves.toEqual({
      sent: false,
      error: 'bad_row',
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe('a run', () => {
  const rows = (from: number, n: number): ClaimedWarning[] =>
    Array.from({ length: n }, (_, i) => ({
      warning_id: from + i,
      email: `u${from + i}@example.test`,
      delete_on: '2026-11-24',
    }));

  function queue(batches: ClaimedWarning[][], outcome: (row: ClaimedWarning) => SendResult) {
    const finished: [number, boolean][] = [];
    const sentTo: number[] = [];
    let claims = 0;
    return {
      finished,
      sentTo,
      claims: () => claims,
      deps: {
        claim: async () => batches[claims++] ?? [],
        finish: async (id: number, sent: boolean) => {
          finished.push([id, sent]);
        },
        send: async (row: ClaimedWarning) => {
          sentTo.push(row.warning_id);
          return outcome(row);
        },
      },
    };
  }

  it('sends everything claimed and finishes each row once', async () => {
    const q = queue([rows(1, BATCH_SIZE), rows(100, 2)], () => ({ sent: true }));
    await expect(runWarnings(q.deps)).resolves.toEqual({
      sent: BATCH_SIZE + 2,
      failed: 0,
      errors: {},
      stopped: false,
    });
    expect(q.finished).toHaveLength(BATCH_SIZE + 2);
    expect(new Set(q.finished.map(([id]) => id)).size).toBe(BATCH_SIZE + 2);
    expect(q.finished.every(([, sent]) => sent)).toBe(true);
    expect(q.claims()).toBe(2);
  });

  it('does nothing on an empty queue', async () => {
    const q = queue([], () => ({ sent: true }));
    await expect(runWarnings(q.deps)).resolves.toEqual({
      sent: 0,
      failed: 0,
      errors: {},
      stopped: false,
    });
    expect(q.finished).toEqual([]);
  });

  it('releases a refused email at the end, so this run does not try it again', async () => {
    const q = queue([rows(1, 3)], (row) =>
      row.warning_id === 2 ? { sent: false, error: 'brevo_rejected' } : { sent: true },
    );
    await expect(runWarnings(q.deps)).resolves.toEqual({
      sent: 2,
      failed: 1,
      errors: { brevo_rejected: 1 },
      stopped: false,
    });
    expect(q.finished).toEqual([
      [1, true],
      [3, true],
      [2, false],
    ]);
  });

  it('stops on a refused key and hands the rest back untried', async () => {
    const q = queue([rows(1, 3)], () => ({ sent: false, error: 'brevo_unauthorized' }));
    await expect(runWarnings(q.deps)).resolves.toEqual({
      sent: 0,
      failed: 1,
      errors: { brevo_unauthorized: 1 },
      stopped: true,
    });
    expect(q.sentTo).toEqual([1]);
    expect(q.finished).toEqual([
      [1, false],
      [2, false],
      [3, false],
    ]);
  });

  it('never puts an address in what it returns', async () => {
    const q = queue([rows(1, 2)], () => ({ sent: false, error: 'brevo_rejected' }));
    expect(JSON.stringify(await runWarnings(q.deps))).not.toContain('@');
  });
});
