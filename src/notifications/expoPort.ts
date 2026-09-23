import * as Notifications from 'expo-notifications';

import type { ScheduledReminder } from '@/domain/activities';
import type { PlacedReminder } from '@/domain/reminders/reconcile';

import type { NotificationPermission, NotificationPort } from './port';

/** Our own fields, carried on the notification so `placed()` can read them back. */
type Carried = {
  moraki: {
    id: string;
    category: ScheduledReminder['category'];
    bodyKey: string;
    values?: Record<string, string>;
  };
};

const asPermission = (status: Notifications.PermissionStatus): NotificationPermission =>
  status === 'granted' ? 'granted' : status === 'denied' ? 'denied' : 'undetermined';

/**
 * The real port (SDD 6.2). Everything is a local notification: nothing is
 * sent to a server, so a reminder fires with no signal.
 *
 * The scheduled text is passed in already translated, and never contains an
 * amount or anything about the baby's health — it shows on a lock screen
 * (rule 8).
 */
export function createExpoNotificationPort(): NotificationPort {
  return {
    async permission() {
      return asPermission((await Notifications.getPermissionsAsync()).status);
    },

    async request() {
      const current = await Notifications.getPermissionsAsync();
      // Asking again once someone has said no does nothing on either platform;
      // they have to change it in system settings.
      if (!current.canAskAgain) return asPermission(current.status);
      return asPermission((await Notifications.requestPermissionsAsync()).status);
    },

    async placed() {
      const all = await Notifications.getAllScheduledNotificationsAsync();
      return all.flatMap((entry): PlacedReminder[] => {
        const carried = (entry.content.data as Partial<Carried> | undefined)?.moraki;
        const trigger = entry.trigger as { type?: string; value?: number; date?: number } | null;
        const at = typeof trigger?.value === 'number' ? trigger.value : trigger?.date;
        if (!carried || typeof at !== 'number') return [];
        return [
          {
            handle: entry.identifier,
            id: carried.id,
            category: carried.category,
            at,
            bodyKey: carried.bodyKey,
            ...(carried.values ? { values: carried.values } : {}),
          },
        ];
      });
    },

    async place(reminder, text) {
      const data: Carried = {
        moraki: {
          id: reminder.id,
          category: reminder.category,
          bodyKey: reminder.bodyKey,
          ...(reminder.values ? { values: reminder.values } : {}),
        },
      };
      return Notifications.scheduleNotificationAsync({
        content: { title: text.title, body: text.body, data },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: reminder.at },
      });
    },

    async cancel(handle) {
      await Notifications.cancelScheduledNotificationAsync(handle);
    },
  };
}
