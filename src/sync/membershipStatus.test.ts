import type { Auth } from './auth';
import {
  fetchMembershipStatus,
  MembershipStatusError,
  recordCaregiverAgreement,
} from './membershipStatus';

const HOUSEHOLD = '0190a0b0-0000-7000-8000-0000000000a1';

/** An Auth whose rpc answers as given, and remembers what it was asked. */
function answering(answer: () => Promise<{ data: unknown; error: unknown }>) {
  const calls: { fn: string; args: unknown }[] = [];
  const auth = {
    client: {
      rpc: (fn: string, args: unknown) => {
        calls.push({ fn, args });
        return answer();
      },
    },
  } as unknown as Auth;
  return { auth, calls };
}

describe('fetchMembershipStatus (P0.2)', () => {
  it('reads a member’s role, guardian status, access and baby', async () => {
    const { auth, calls } = answering(async () => ({
      data: [
        {
          status: 'member',
          role: 'caregiver',
          is_guardian: false,
          access: 'needs_agreement',
          baby_id: 'b1',
          baby_name: 'Ella',
        },
      ],
      error: null,
    }));
    expect(await fetchMembershipStatus(auth, HOUSEHOLD)).toEqual({
      status: 'member',
      role: 'caregiver',
      isGuardian: false,
      access: 'needs_agreement',
      baby: { id: 'b1', name: 'Ella' },
    });
    expect(calls).toEqual([{ fn: 'my_membership_status', args: { household_id: HOUSEHOLD } }]);
  });

  it('says plainly when the account is no longer a member, or the household is gone', async () => {
    for (const status of ['not_member', 'household_gone'] as const) {
      const { auth } = answering(async () => ({ data: [{ status }], error: null }));
      expect(await fetchMembershipStatus(auth, HOUSEHOLD)).toEqual({ status });
    }
  });

  it('throws, rather than guessing, for an error, a dropped request or an odd answer', async () => {
    const answers = [
      async () => ({ data: null, error: { code: '42501', message: 'no' } }),
      async () => ({ data: null, error: { message: 'TypeError: Network request failed' } }),
      async () => {
        throw new TypeError('Network request failed');
      },
      async () => ({ data: [], error: null }),
      async () => ({ data: [{ status: 'member', role: null, access: null }], error: null }),
    ];
    for (const answer of answers) {
      const { auth } = answering(answer);
      await expect(fetchMembershipStatus(auth, HOUSEHOLD)).rejects.toBeInstanceOf(
        MembershipStatusError,
      );
    }
  });
});

describe('recordCaregiverAgreement (P0.2)', () => {
  it('records the agreement in force, for the household, in the language shown', async () => {
    const { auth, calls } = answering(async () => ({ data: 'now', error: null }));
    await recordCaregiverAgreement(auth, HOUSEHOLD, 'el');
    expect(calls).toEqual([
      {
        fn: 'record_consent',
        args: {
          purpose: 'caregiver_agreement',
          version: '2026-10-24',
          action: 'grant',
          household_id: HOUSEHOLD,
          locale: 'el',
          text_key: 'caregiverAgreement',
        },
      },
    ]);
  });

  it('says offline when the request never got there', async () => {
    const { auth } = answering(async () => ({
      data: null,
      error: { message: 'TypeError: Network request failed' },
    }));
    await expect(recordCaregiverAgreement(auth, HOUSEHOLD, 'en')).rejects.toThrow('offline');
  });
});
