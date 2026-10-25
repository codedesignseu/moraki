import { useMemo, useSyncExternalStore } from 'react';

import { useCaregiversRepository } from '@/db/react';
import { useAuth } from '@/sync/AuthProvider';

export type CaregiverRow = {
  userId: string;
  /** Their name, or a word for yourself. */
  name: string;
  role: 'owner' | 'caregiver' | 'viewer';
  you: boolean;
  /** Declared they are the baby's parent or guardian, so may take over (P0.1). */
  isGuardian: boolean;
};

/** Everyone in the household, oldest member first (P2-12). */
export function useCaregivers(): CaregiverRow[] {
  const repository = useCaregiversRepository();
  const { state } = useAuth();
  const version = useSyncExternalStore(repository.subscribe, repository.version);
  const me = state.status === 'signedIn' ? state.user.id : null;

  return useMemo(
    () =>
      repository.list().map((row) => ({
        userId: row.userId,
        name: row.displayName,
        role: row.role,
        you: row.userId === me,
        isGuardian: row.isGuardian,
      })),
    // `version` is the change signal: re-read after the household changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [repository, version, me],
  );
}
