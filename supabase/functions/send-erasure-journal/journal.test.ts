import {
  BREVO_URL,
  CSV_HEADER,
  MAX_DAYS,
  buildBrevoRequest,
  composeJournal,
  isAuthorized,
  readConfig,
  runJournal,
  sendJournal,
  toCsv,
  type DueDay,
  type JournalRow,
  type SendResult,
} from './journal';

const ROWS: JournalRow[] = [
  {
    kind: 'account',
    subject_id: '00000000-0000-0000-0000-000000000001',
    erased_at: '2026-10-25T10:00:00.123456+00:00',
    reason: 'user_request',
  },
  {
    kind: 'household',
    subject_id: 'AAAAAAAA-0000-0000-0000-000000000002',
    erased_at: '2026-10-25T03:31:00+00:00',
    reason: 'inactivity',
  },
  {
    kind: 'entry',
    subject_id: 'eeeeeeee-0000-0000-0000-000000000003',
    erased_at: '2026-10-22T21:15:00+03:00',
    reason: 'user_request',
  },
];

const respond = (status: number) => (async () => new Response('{}', { status })) as typeof fetch;

describe('the configuration', () => {
  const env: Record<string, string> = {
    BREVO_API_KEY: 'k',
    ERASURE_JOURNAL_CRON_SECRET: 's',
    ERASURE_JOURNAL_TO: ' owner@example.test ',
  };

  it('needs all three secrets', () => {
    expect(readConfig((n) => env[n])).toEqual({
      brevoApiKey: 'k',
      cronSecret: 's',
      to: 'owner@example.test',
    });
    for (const missing of Object.keys(env)) {
      expect(readConfig((n) => (n === missing ? ' ' : env[n]))).toBeNull();
      expect(readConfig((n) => (n === missing ? undefined : env[n]))).toBeNull();
    }
  });

  it('takes one address only', () => {
    for (const to of ['a@example.test,b@example.test', 'a@example.test b@x.test', 'owner', 'a@b']) {
      expect(readConfig((n) => (n === 'ERASURE_JOURNAL_TO' ? to : env[n]))).toBeNull();
    }
  });

  it('lets in only the exact shared secret', () => {
    expect(isAuthorized('secret-1', 'secret-1')).toBe(true);
    expect(isAuthorized('secret-2', 'secret-1')).toBe(false);
    expect(isAuthorized('secret-1x', 'secret-1')).toBe(false);
    expect(isAuthorized(null, 'secret-1')).toBe(false);
    expect(isAuthorized('', '')).toBe(false);
  });
});

describe('the CSV', () => {
  it('has four columns: kind, id, erased_at in UTC, reason; CRLF lines', () => {
    expect(toCsv(ROWS)).toBe(
      [
        CSV_HEADER,
        'account,00000000-0000-0000-0000-000000000001,2026-10-25T10:00:00.123Z,user_request',
        'household,aaaaaaaa-0000-0000-0000-000000000002,2026-10-25T03:31:00.000Z,inactivity',
        'entry,eeeeeeee-0000-0000-0000-000000000003,2026-10-22T18:15:00.000Z,user_request',
        '',
      ].join('\r\n'),
    );
    expect(CSV_HEADER).toBe('kind,subject_id,erased_at_utc,reason');
  });

  it('refuses a row that is not what the log holds', () => {
    const bad: Partial<JournalRow>[] = [
      { kind: 'baby' },
      { subject_id: 'Maria' },
      { subject_id: 'owner@example.test' },
      { erased_at: 'yesterday' },
      { reason: 'user,request' },
      { reason: 'Said "delete me"' },
    ];
    for (const change of bad) {
      expect(toCsv([...ROWS, { ...ROWS[0]!, ...change }])).toBeNull();
    }
  });

  it('carries nothing but the four fields', () => {
    const extra = { ...ROWS[0]!, email: 'a@example.test', name: 'Ella' } as JournalRow;
    const csv = toCsv([extra]) ?? '';
    expect(csv).not.toContain('@');
    expect(csv).not.toContain('Ella');
  });
});

describe('the email', () => {
  it('is named by the day, counts by kind, and puts the ids only in the attachment', () => {
    const email = composeJournal('2026-10-25', ROWS);
    expect(email?.subject).toBe('Moraki erasure journal 2026-10-25');
    expect(email?.filename).toBe('moraki-erasure-journal-2026-10-25.csv');
    expect(email?.text).toContain(
      '3 erasures were logged that day: 1 account, 1 household, 1 entry.',
    );
    expect(email?.text).toContain('Keep this email for at least 35 days.');
    expect(email?.text).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}/i);
    expect(email?.csv).toBe(toCsv(ROWS));
  });

  it('is not built for an empty day, a bad day or a bad row', () => {
    expect(composeJournal('2026-10-25', [])).toBeNull();
    expect(composeJournal('25/10/2026', ROWS)).toBeNull();
    expect(composeJournal('2026-10-25', [{ ...ROWS[0]!, kind: 'x' }])).toBeNull();
  });
});

describe('the Brevo request', () => {
  it('posts plain text from hello@moraki.app to the owner, with the CSV attached in base64', () => {
    const email = composeJournal('2026-10-25', ROWS)!;
    const { url, init } = buildBrevoRequest('KEY', 'owner@example.test', email);
    expect(url).toBe('https://api.brevo.com/v3/smtp/email');
    expect(url).toBe(BREVO_URL);
    expect(init.method).toBe('POST');
    expect(init.headers).toEqual({
      'api-key': 'KEY',
      'Content-Type': 'application/json',
      Accept: 'application/json',
    });
    const body = JSON.parse(init.body as string);
    expect(body).toEqual({
      sender: { name: 'Moraki', email: 'hello@moraki.app' },
      to: [{ email: 'owner@example.test' }],
      subject: 'Moraki erasure journal 2026-10-25',
      textContent: email.text,
      attachment: [{ name: 'moraki-erasure-journal-2026-10-25.csv', content: expect.any(String) }],
      tags: ['erasure-journal'],
    });
    expect(Buffer.from(body.attachment[0].content, 'base64').toString('ascii')).toBe(email.csv);
  });
});

describe('sending one day', () => {
  it('is sent when Brevo answers 201', async () => {
    const fetchImpl = jest.fn(respond(201));
    await expect(
      sendJournal(fetchImpl as unknown as typeof fetch, 'KEY', 'o@example.test', '2026-10-25', ROWS),
    ).resolves.toEqual({ sent: true });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it.each([
    [400, 'brevo_rejected'],
    [401, 'brevo_unauthorized'],
    [403, 'brevo_unauthorized'],
    [429, 'brevo_rate_limited'],
    [503, 'brevo_unavailable'],
  ])('answers %i with %s', async (status, error) => {
    await expect(
      sendJournal(respond(status), 'KEY', 'o@example.test', '2026-10-25', ROWS),
    ).resolves.toEqual({ sent: false, error });
  });

  it('is unreachable when the request throws', async () => {
    const fetchImpl = (async () => {
      throw new Error('offline');
    }) as typeof fetch;
    await expect(
      sendJournal(fetchImpl, 'KEY', 'o@example.test', '2026-10-25', ROWS),
    ).resolves.toEqual({ sent: false, error: 'brevo_unreachable' });
  });

  it('never calls Brevo with a bad row', async () => {
    const fetchImpl = jest.fn() as unknown as typeof fetch;
    await expect(
      sendJournal(fetchImpl, 'KEY', 'o@example.test', '2026-10-25', [
        { ...ROWS[0]!, subject_id: 'x' },
      ]),
    ).resolves.toEqual({ sent: false, error: 'bad_row' });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe('a run', () => {
  function journal(days: DueDay[], outcome: (day: string) => SendResult) {
    const log: string[] = [];
    return {
      log,
      deps: {
        claim: async (max: number) => {
          log.push(`claim ${max}`);
          return days;
        },
        rows: async (day: string) => {
          log.push(`rows ${day}`);
          return ROWS.slice(0, days.find((d) => d.journal_day === day)?.entries ?? 0);
        },
        finish: async (day: string) => {
          log.push(`finish ${day}`);
          return true;
        },
        release: async () => {
          log.push('release');
        },
        send: async (day: string) => {
          log.push(`send ${day}`);
          return outcome(day);
        },
      },
    };
  }

  it('emails each day with rows, skips an empty one, in order, then releases', async () => {
    const j = journal(
      [
        { journal_day: '2026-10-23', entries: 2 },
        { journal_day: '2026-10-24', entries: 0 },
        { journal_day: '2026-10-25', entries: 3 },
      ],
      () => ({ sent: true }),
    );
    await expect(runJournal(j.deps)).resolves.toEqual({ sent: 2, skipped: 1, entries: 5 });
    expect(j.log).toEqual([
      `claim ${MAX_DAYS}`,
      'rows 2026-10-23',
      'send 2026-10-23',
      'finish 2026-10-23',
      'finish 2026-10-24',
      'rows 2026-10-25',
      'send 2026-10-25',
      'finish 2026-10-25',
      'release',
    ]);
  });

  it('sends nothing and still releases when nothing is due', async () => {
    const j = journal([], () => ({ sent: true }));
    await expect(runJournal(j.deps)).resolves.toEqual({ sent: 0, skipped: 0, entries: 0 });
    expect(j.log).toEqual([`claim ${MAX_DAYS}`, 'release']);
  });

  it('stops at a day Brevo refused, marking neither it nor any later day', async () => {
    const j = journal(
      [
        { journal_day: '2026-10-24', entries: 1 },
        { journal_day: '2026-10-25', entries: 1 },
      ],
      () => ({ sent: false, error: 'brevo_unavailable' }),
    );
    await expect(runJournal(j.deps)).resolves.toEqual({
      sent: 0,
      skipped: 0,
      entries: 0,
      error: 'brevo_unavailable',
    });
    expect(j.log).toEqual([`claim ${MAX_DAYS}`, 'rows 2026-10-24', 'send 2026-10-24', 'release']);
  });

  it('releases the journal even when a call fails', async () => {
    const j = journal([{ journal_day: '2026-10-25', entries: 1 }], () => ({ sent: true }));
    const deps = {
      ...j.deps,
      rows: async () => {
        throw new Error('rows_failed');
      },
    };
    await expect(runJournal(deps)).rejects.toThrow('rows_failed');
    expect(j.log).toContain('release');
  });

  it('never puts an id or an address in what it returns', async () => {
    const j = journal([{ journal_day: '2026-10-25', entries: 3 }], () => ({ sent: true }));
    const out = JSON.stringify(await runJournal(j.deps));
    expect(out).not.toContain('@');
    expect(out).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}/);
  });
});
