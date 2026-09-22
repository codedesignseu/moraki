import { useState } from 'react';
import { Share } from 'react-native';

import { useAuth } from '@/sync/AuthProvider';
import {
  createInvite,
  formatCode,
  inviteLink,
  InviteError,
  type Invite,
  type InviteFailure,
  type InviteRole,
} from '@/sync/invites';
import { useAccountHousehold } from '@/sync/useAccountHousehold';

/** The owner creates a single-use code and shares it as a link (SDD 7, `join/[code]`). */
export function useInvite() {
  const { auth } = useAuth();
  const { household } = useAccountHousehold();
  const [role, setRole] = useState<InviteRole>('caregiver');
  const [invite, setInvite] = useState<Invite | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<InviteFailure | null>(null);

  async function create() {
    if (!auth || !household) return setProblem('signed_out');
    setBusy(true);
    setProblem(null);
    try {
      setInvite(await createInvite(auth, household.householdId, role));
    } catch (error) {
      setProblem(error instanceof InviteError ? error.reason : 'unknown');
    } finally {
      setBusy(false);
    }
  }

  return {
    /** Only the owner may invite (SDD 4.3). */
    canInvite: household?.role === 'owner',
    role,
    setRole,
    invite: invite && {
      code: formatCode(invite.code),
      link: inviteLink(invite.code),
      expiresAt: invite.expiresAt,
    },
    busy,
    problem,
    create: () => void create(),
    share: (message: string) => void Share.share({ message }),
  };
}
