import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useDevicePref, useEvents } from '@/db/react';
import { computeAllReminders } from '@/domain/reminders/allReminders';
import { reconcile } from '@/domain/reminders/reconcile';
import { useReminderSettings } from '@/sync/useReminderSettings';
import { deviceTimeZone } from '@/ui/deviceTimeZone';

import type { NotificationPermission, NotificationPort } from './port';

export type RemindersState = {
  /** On for this account on this phone (SDD 6.2: per user, per device). */
  enabled: boolean;
  permission: NotificationPermission;
  /** Turning them on asks the system first; false means the system said no. */
  setEnabled: (on: boolean) => Promise<boolean>;
};

/**
 * Keeps this phone's scheduled reminders matching what the events say
 * (SDD 6.2): every write recomputes them, and anything that no longer fits is
 * cancelled. All of it is local, so a reminder fires with no signal and no
 * server, and every phone computes the same times from the same events.
 */
export function useReminders(port: NotificationPort | null): RemindersState {
  const events = useEvents();
  const { t: typedT } = useTranslation();
  // The body key comes from the reminder, which the registry's completeness
  // test checks, so it is looked up loosely here (as HomeScreen does).
  const t = typedT as unknown as (key: string, values?: Record<string, string>) => string;
  const [enabled, setStored] = useDevicePref('reminders');
  const { settings } = useReminderSettings();
  const [permission, setPermission] = useState<NotificationPermission>('undetermined');
  // The last run's work, so an in-flight recompute can't be overtaken.
  const running = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    if (!port) return;
    let active = true;
    void port.permission().then((p) => active && setPermission(p));
    return () => {
      active = false;
    };
  }, [port]);

  const sync = useCallback(async () => {
    if (!port) return;
    const tz = deviceTimeZone();
    const wanted =
      enabled && permission === 'granted'
        ? computeAllReminders(events, { ...settings, enabled: true }, Date.now(), tz)
        : [];
    const { cancel, schedule } = reconcile(await port.placed(), wanted);
    for (const handle of cancel) await port.cancel(handle);
    for (const reminder of schedule) {
      await port.place(reminder, {
        title: t('reminders.title'),
        // Never an amount and never anything about health: this shows on a
        // lock screen (rule 8).
        body: t(reminder.bodyKey, reminder.values ?? {}),
      });
    }
  }, [port, events, enabled, permission, settings, t]);

  useEffect(() => {
    running.current = running.current.then(sync, sync);
  }, [sync]);

  return {
    enabled,
    permission,
    setEnabled: useCallback(
      async (on: boolean) => {
        if (!on) {
          setStored(false);
          return false;
        }
        const granted = port ? await port.request() : 'denied';
        setPermission(granted);
        // Turning them on with the system saying no would be a switch that
        // lies: it stays off, and the screen says why.
        setStored(granted === 'granted');
        return granted === 'granted';
      },
      [port, setStored],
    ),
  };
}
