import { useCallback, useState } from 'react';

import { useDevicePref } from '@/db/react';
import { useAuth } from '@/sync/AuthProvider';

/** A request that never reached the server, however it was reported. */
function offline(error: unknown): boolean {
  const { code, message } = (error ?? {}) as { code?: string; message?: string };
  return !code && /fetch|network/i.test(message ?? '');
}

/** The policy this build asks about. It must match the server's version. */
export const CONSENT_VERSION = '2026-09-23';

export type ConsentState = {
  /** Whether the signed-in account has agreed, as far as this phone knows. */
  granted: boolean;
  /**
   * The same question asked about an account by id, for the moment just after
   * signing in: `granted` was worked out while nobody was signed in yet.
   */
  grantedBy: (userId: string) => boolean;
  /** Null until something goes wrong; a reason key otherwise. */
  problem: 'offline' | 'signed_out' | 'unknown' | null;
  busy: boolean;
  /** Resolves true only when the server recorded it, so the screen can close. */
  agree: () => Promise<boolean>;
  withdraw: () => Promise<boolean>;
};

/**
 * Consent to health data being processed (SDD 12, Article 9(2)(a)). Every
 * caregiver answers for themselves, on its own screen, never bundled with
 * anything else, and the answer is recorded with the policy version.
 *
 * The server is the record; this phone keeps a copy so it knows whether to
 * ask without the network. Withdrawing stops this account syncing and deletes
 * nothing: what is already there stays readable, to export or delete.
 */
export function useConsent(): ConsentState {
  const { auth, state } = useAuth();
  const [consent, setConsent] = useDevicePref('consent');
  const [problem, setProblem] = useState<ConsentState['problem']>(null);
  const [busy, setBusy] = useState(false);
  const userId = state.status === 'signedIn' ? state.user.id : null;

  const call = useCallback(
    async (fn: 'grant_consent' | 'withdraw_consent'): Promise<boolean> => {
      if (!auth || userId === null) {
        setProblem('signed_out');
        return false;
      }
      setProblem(null);
      setBusy(true);
      try {
        const { error } = await auth.client.rpc(fn);
        if (error) {
          // postgrest-js reports a failed request with no code.
          setProblem(offline(error) ? 'offline' : 'unknown');
          return false;
        }
        setConsent(
          fn === 'grant_consent'
            ? { userId, version: CONSENT_VERSION, grantedAt: Date.now() }
            : null,
        );
        return true;
      } catch (thrown) {
        setProblem(offline(thrown) ? 'offline' : 'unknown');
        return false;
      } finally {
        setBusy(false);
      }
    },
    [auth, userId, setConsent],
  );

  return {
    granted: consent !== null && consent.userId === userId,
    grantedBy: (who: string) => consent !== null && consent.userId === who,
    problem,
    busy,
    agree: useCallback(() => call('grant_consent'), [call]),
    withdraw: useCallback(() => call('withdraw_consent'), [call]),
  };
}
