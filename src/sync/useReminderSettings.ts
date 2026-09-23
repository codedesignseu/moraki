import { useCallback, useMemo } from 'react';

import { useDevicePref } from '@/db/react';
import type { Settings } from '@/domain/activities';
import { useAuth } from './AuthProvider';
import { useAccountHousehold } from './useAccountHousehold';

/** SDD 4.2's limits, shared by the schema, the steppers and the server. */
export const INTERVAL_MIN = { step: 15, min: 60, max: 480 } as const;
export const SECOND_MIN = { step: 15, min: 15, max: 120 } as const;

export type ReminderSettings = {
  settings: Omit<Settings, 'enabled'>;
  setIntervalMin: (minutes: number) => void;
  setSecondReminderMin: (minutes: number | null) => void;
  /** Whether this account may change it for everyone, or only for this phone. */
  sharedWithHousehold: boolean;
};

/**
 * The feed interval and the optional second reminder (SDD 4.2). Home's
 * reminder line and the notification scheduler both read this, so they can't
 * disagree.
 *
 * The household owns the number, so an owner's change is written to the
 * household row as well as kept here. Until a pull brings that row back
 * (P2-F11), another phone keeps its own copy — which is why the screen says
 * whose reminders are being changed.
 */
export function useReminderSettings(): ReminderSettings {
  const [intervalMin, setInterval] = useDevicePref('reminderIntervalMin');
  const [secondReminderMin, setSecond] = useDevicePref('secondReminderMin');
  const { auth } = useAuth();
  const { household } = useAccountHousehold();
  const owner = household?.role === 'owner';

  const writeThrough = useCallback(
    (columns: { reminder_interval_min?: number; second_reminder_min?: number | null }) => {
      if (!auth || !household || !owner) return;
      // The household's record of it. A failure changes nothing here: the
      // phone keeps the value it was given, and the next change tries again.
      void auth.client.from('households').update(columns).eq('id', household.householdId);
    },
    [auth, household, owner],
  );

  return {
    settings: useMemo(() => ({ intervalMin, secondReminderMin }), [intervalMin, secondReminderMin]),
    sharedWithHousehold: owner,
    setIntervalMin: useCallback(
      (minutes: number) => {
        setInterval(minutes);
        writeThrough({ reminder_interval_min: minutes });
      },
      [setInterval, writeThrough],
    ),
    setSecondReminderMin: useCallback(
      (minutes: number | null) => {
        setSecond(minutes);
        writeThrough({ second_reminder_min: minutes });
      },
      [setSecond, writeThrough],
    ),
  };
}
