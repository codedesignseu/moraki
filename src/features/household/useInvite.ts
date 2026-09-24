import { useEffect, useState } from 'react';
import { Share } from 'react-native';

import { useAuth } from '@/sync/AuthProvider';
import {
  createInvite,
  formatCode,
  inviteLink,
  InviteError,
  listInvites,
  revokeInvite,
  type Invite,
  type InviteFailure,
  type InviteRole,
  type OpenInvite,
} from '@/sync/invites';
import { useAccountHousehold } from '@/sync/useAccountHousehold';
import { useNow } from '@/ui/useNow';

/** The owner creates a single-use code and shares it as a link (SDD 7, `join/[code]`). */
export function useInvite() {
  const { auth } = useAuth();
  const { household } = useAccountHousehold();
  const [role, setRole] = useState<InviteRole>('caregiver');
  const [invite, setInvite] = useState<Invite | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<InviteFailure | null>(null);
  /** Codes made earlier that nobody has used (P2-F8). */
  const [open, setOpen] = useState<OpenInvite[]>([]);
  // A code expires while the screen is open; the minute tick moves it over.
  const now = useNow(60_000);

  // Re-read after making or withdrawing one. Bumping this is what asks
  // again; the effect below is the only place that reads.
  const [reloads, setReloads] = useState(0);
  const householdId = household?.householdId;
  const isOwner = household?.role === 'owner';

  useEffect(() => {
    if (!auth || !householdId || !isOwner) return;
    let active = true;
    listInvites(auth, householdId).then(
      (rows) => {
        if (active) setOpen(rows);
      },
      // A list that didn't arrive is not worth an error on this screen: the
      // code just made is still on it, and the next open tries again.
      () => {},
    );
    return () => {
      active = false;
    };
  }, [auth, householdId, isOwner, reloads]);

  async function create() {
    if (!auth || !household) return setProblem('signed_out');
    setBusy(true);
    setProblem(null);
    try {
      setInvite(await createInvite(auth, household.householdId, role));
      setReloads((n) => n + 1);
    } catch (error) {
      setProblem(error instanceof InviteError ? error.reason : 'unknown');
    } finally {
      setBusy(false);
    }
  }

  async function revoke(code: string) {
    if (!auth) return setProblem('signed_out');
    setBusy(true);
    setProblem(null);
    try {
      await revokeInvite(auth, code);
      // The code just made is the one most likely revoked; clear it too, or
      // the screen would keep offering a link that no longer works.
      setInvite((current) => (current && current.code === code ? null : current));
      setReloads((n) => n + 1);
    } catch (error) {
      setProblem(error instanceof InviteError ? error.reason : 'unknown');
    } finally {
      setBusy(false);
    }
  }

  return {
    /** Only the owner may invite (SDD 4.3). */
    canInvite: household?.role === 'owner',
    /** Unused codes, newest first, each with whether it has expired. */
    open: open.map((row) => ({
      code: row.code,
      shown: formatCode(row.code),
      role: row.role,
      expiresAt: row.expiresAt,
      expired: row.expiresAt <= now,
    })),
    revoke: (code: string) => void revoke(code),
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
