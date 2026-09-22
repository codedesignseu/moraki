import { useState } from 'react';

import { useAuth } from '@/sync/AuthProvider';
import type { Relation } from '@/sync/household';
import {
  acceptInvite,
  CODE_LENGTH,
  formatCode,
  InviteError,
  normaliseCode,
  type InviteFailure,
} from '@/sync/invites';
import { useAccountHousehold } from '@/sync/useAccountHousehold';

export type JoinProblem = InviteFailure | 'short_code' | 'display_name';

/**
 * Joins a household with a code, from the invite link or typed in. Nothing on
 * this phone changes: entries logged here keep their local ids until P2-11
 * asks what should happen to them.
 */
export function useJoin(initialCode: string, onDone: () => void) {
  const { auth, state } = useAuth();
  const { household, remember } = useAccountHousehold();
  const [code, setCode] = useState(() => normaliseCode(initialCode));
  const [displayName, setDisplayName] = useState('');
  const [relation, setRelation] = useState<Relation | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<JoinProblem | null>(null);

  async function join() {
    if (!auth || state.status !== 'signedIn') return setProblem('signed_out');
    if (code.length !== CODE_LENGTH) return setProblem('short_code');
    if (displayName.trim() === '') return setProblem('display_name');
    setBusy(true);
    setProblem(null);
    try {
      const joined = await acceptInvite(auth, code, displayName, relation);
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
    join: () => void join(),
  };
}
