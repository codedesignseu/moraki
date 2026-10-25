import type { Auth } from './auth';
import { fetchAccountRecords } from './accountRecords';

type Answer = { data: unknown[] | null; error: { code?: string; message: string } | null };

/** A client whose `from(table).select().eq()` answers from a table of replies. */
function fakeAuth(answers: Record<string, Answer | Error>) {
  const asked: { table: string; column: string; value: string }[] = [];
  const client = {
    from: (table: string) => ({
      select: () => ({
        eq: async (column: string, value: string) => {
          asked.push({ table, column, value });
          const answer = answers[table] ?? { data: [], error: null };
          if (answer instanceof Error) throw answer;
          return answer;
        },
      }),
    }),
  };
  return { auth: { client } as unknown as Auth, asked };
}

const ok = (data: unknown[]): Answer => ({ data, error: null });
const missing: Answer = { data: null, error: { code: 'PGRST205', message: 'no such table' } };

const consentRow = {
  policy_version: '2026-10-18',
  granted_at: '2026-10-20T08:00:00Z',
  withdrawn_at: null,
};
const feedbackRow = {
  kind: 'problem',
  message: 'Sync stalled',
  app_version: '1.0.0',
  platform: 'ios',
  locale: 'el',
  created_at: '2026-10-21T09:30:00Z',
};

describe('the account records an export carries (P0.10)', () => {
  it('reads consents and feedback as the person, and maps them', async () => {
    const { auth, asked } = fakeAuth({
      consents: ok([consentRow]),
      consent_events: missing,
      feedback: ok([feedbackRow]),
    });
    const records = await fetchAccountRecords(auth, 'u1');

    expect(asked.every((a) => a.column === 'user_id' && a.value === 'u1')).toBe(true);
    expect(records).toEqual({
      consents: [
        {
          policyVersion: '2026-10-18',
          grantedAt: Date.parse('2026-10-20T08:00:00Z'),
          withdrawnAt: null,
        },
      ],
      consentEvents: null,
      feedback: [
        {
          kind: 'problem',
          message: 'Sync stalled',
          appVersion: '1.0.0',
          platform: 'ios',
          locale: 'el',
          sentAt: Date.parse('2026-10-21T09:30:00Z'),
        },
      ],
    });
  });

  it('includes the consent history where the server keeps one', async () => {
    const { auth } = fakeAuth({
      consent_events: ok([
        {
          purpose: 'health_data',
          version: '2026-10-18',
          action: 'grant',
          text_key: 'consent',
          locale: 'en',
          household_id: null,
          baby_id: null,
          created_at: '2026-10-20T08:00:00Z',
        },
      ]),
    });
    const records = await fetchAccountRecords(auth, 'u1');
    expect(records?.consentEvents).toEqual([
      {
        purpose: 'health_data',
        version: '2026-10-18',
        action: 'grant',
        textKey: 'consent',
        locale: 'en',
        householdId: null,
        babyId: null,
        at: Date.parse('2026-10-20T08:00:00Z'),
      },
    ]);
  });

  it('is null when a record the person is owed cannot be read', async () => {
    const { auth } = fakeAuth({ feedback: { data: null, error: { message: 'fetch failed' } } });
    expect(await fetchAccountRecords(auth, 'u1')).toBeNull();
  });

  it('is null when the network throws', async () => {
    const { auth } = fakeAuth({ consents: new Error('Network request failed') });
    expect(await fetchAccountRecords(auth, 'u1')).toBeNull();
  });
});
