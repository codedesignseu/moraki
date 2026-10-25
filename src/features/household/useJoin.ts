import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useDevicePref } from '@/db/react';
import { consentLocale } from '@/domain/consent/consent';
import { useTerms } from '@/privacy/useTerms';
import { useAuth } from '@/sync/AuthProvider';
import type { Relation } from '@/sync/household';
import {
  acceptInvite,
  CODE_LENGTH,
  formatCode,
  InviteError,
  normaliseCode,
  previewInvite,
  type InviteFailure,
  type InviteRole,
} from '@/sync/invites';
import { useAccountHousehold } from '@/sync/useAccountHousehold';

export type JoinProblem = InviteFailure | 'short_code' | 'display_name' | 'terms' | 'unticked';

/**
 * Joins a household with a code, from the invite link or typed in. Nothing on
 * this phone changes: entries logged here keep their local ids until P2-11
 * asks what should happen to them.
 *
 * Two steps (P0.2): the code and name, then, once the server has said which
 * role the code gives, the caregiver agreement, accepted as part of joining.
 */
export function useJoin(initialCode: string, onDone: () => void) {
  const { auth, state } = useAuth();
  const { household, remember } = useAccountHousehold();
  const [code, setCode] = useState(() => normaliseCode(initialCode));
  const [displayName, setDisplayName] = useState('');
  const [relation, setRelation] = useState<Relation | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<JoinProblem | null>(null);
  // The role the code gives, once the server has said: the agreement step.
  const [role, setRole] = useState<InviteRole | null>(null);
  const [, setAccess] = useDevicePref('householdAccess');
  const terms = useTerms();
  const { i18n } = useTranslation();

  /** Checks the code and shows what joining means. */
  async function next() {
    if (!auth || state.status !== 'signedIn') return setProblem('signed_out');
    if (code.length !== CODE_LENGTH) return setProblem('short_code');
    if (displayName.trim() === '') return setProblem('display_name');
    // P0.9: joining is for someone who agreed to the Terms.
    if (!(await terms.ensure())) return setProblem('terms');
    setBusy(true);
    setProblem(null);
    try {
      setRole(await previewInvite(auth, code));
    } catch (error) {
      setProblem(error instanceof InviteError ? error.reason : 'unknown');
    } finally {
      setBusy(false);
    }
  }

  /** Joins, accepting the caregiver agreement (P0.2). */
  async function join(ticked: boolean) {
    if (!auth || state.status !== 'signedIn') return setProblem('signed_out');
    if (!ticked) return setProblem('unticked');
    setBusy(true);
    setProblem(null);
    try {
      const joined = await acceptInvite(
        auth,
        code,
        displayName,
        relation,
        consentLocale(i18n.language),
      );
      // The agreement went on record with the membership.
      setAccess({
        userId: state.user.id,
        householdId: joined.householdId,
        access: 'granted',
        isGuardian: false,
      });
      remember({ userId: state.user.id, ...joined });
      onDone();
    } catch (error) {
      setProblem(error instanceof InviteError ? error.reason : 'unknown');
    } finally {
      setBusy(false);
    }
  }

  return {
    signedIn: state.status === 'signedIn',
    /** Already a member: one household per account for now. */
    household,
    code,
    formattedCode: formatCode(code),
    setCode: (value: string) => {
      setCode(normaliseCode(value));
      setProblem(null);
    },
    displayName,
    setDisplayName,
    relation,
    toggleRelation: (value: Relation) =>
      setRelation((current) => (current === value ? null : value)),
    busy,
    problem,
    /** Null on the first step; the role the code gives on the second. */
    role,
    next: () => void next(),
    /** Back to the code and name. */
    back: () => {
      setRole(null);
      setProblem(null);
    },
    join: (ticked: boolean) => void join(ticked),
  };
}
