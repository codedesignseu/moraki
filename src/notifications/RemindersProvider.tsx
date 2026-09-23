import { createContext, useContext, useMemo, type ReactNode } from 'react';

import { useReminders, type RemindersState } from './useReminders';
import type { NotificationPort } from './port';

const RemindersContext = createContext<RemindersState | null>(null);

/**
 * Runs the reminder scheduler for the whole app (SDD 6.2), so every write
 * recomputes what this phone holds. `port` is null in a build with no
 * notification support, and a fake one in tests.
 */
export function RemindersProvider({
  port,
  children,
}: {
  port: NotificationPort | null;
  children: ReactNode;
}) {
  const state = useReminders(port);
  const value = useMemo(() => state, [state]);
  return <RemindersContext.Provider value={value}>{children}</RemindersContext.Provider>;
}

/** Off and unaskable where no provider is mounted, which no screen has to special-case. */
const OFF: RemindersState = {
  enabled: false,
  permission: 'undetermined',
  setEnabled: async () => false,
};

export function useRemindersState(): RemindersState {
  return useContext(RemindersContext) ?? OFF;
}
