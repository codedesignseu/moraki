import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useDevicePref } from '@/db/react';
import { consentLocale, TERMS_VERSION, termsStatus } from '@/domain/consent/consent';
import { useAuth } from '@/sync/AuthProvider';
import { recordTerms, termsOnRecord } from '@/sync/terms';

export type TermsProblem = 'unticked' | 'offline' | 'unknown';

/**
 * The Terms of Use (P0.9): agreed at sign in, recorded on the server with
 * their version, and asked again when the version changes (P1.4). Household
 * setup and joining need it, and until this account has agreed to the
 * version in force, its entries don't sync.
 */
export function useTerms() {
  const { auth, state } = useAuth();
  const [record, setRecord] = useDevicePref('terms');
  const { i18n } = useTranslation();
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<TermsProblem | null>(null);
  const userId = state.status === 'signedIn' ? state.user.id : null;
  const status = termsStatus(record, userId);

  /**
   * Records agreeing, for `who` (the account just signed in, before this
   * phone's state has caught up) or the signed-in account.
   */
  const agree = useCallback(
    async (ticked: boolean, who: string | null = userId): Promise<boolean> => {
      if (!ticked) {
        setProblem('unticked');
        return false;
      }
      if (!auth || !who) {
        setProblem('unknown');
        return false;
      }
      setBusy(true);
      setProblem(null);
      try {
        await recordTerms(auth, consentLocale(i18n.language));
        setRecord({ userId: who, version: TERMS_VERSION });
        return true;
      } catch (error) {
        setProblem(error instanceof Error && error.message === 'offline' ? 'offline' : 'unknown');
        return false;
      } finally {
        setBusy(false);
      }
    },
    [auth, userId, i18n.language, setRecord],
  );

  /**
   * Whether the account has agreed, asking the server if this phone doesn't
   * know (it may have agreed on another phone). For a step that needs it.
   * When the server can't be asked, the step goes ahead and fails on its own
   * (offline), rather than saying the Terms are missing.
   */
  const ensure = useCallback(async (): Promise<boolean> => {
    if (status === 'agreed') return true;
    if (!auth || !userId) return false;
    const found = await termsOnRecord(auth, userId);
    if (found) setRecord({ userId, version: TERMS_VERSION });
    return found !== false;
  }, [status, auth, userId, setRecord]);

  return {
    status,
    agreed: status === 'agreed',
    ensure,
    /** Stores that the server already has this account agreeing. */
    remember: useCallback(
      () => userId && setRecord({ userId, version: TERMS_VERSION }),
      [userId, setRecord],
    ),
    busy,
    problem,
    agree,
  };
}
