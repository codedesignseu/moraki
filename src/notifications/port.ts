import type { ScheduledReminder } from '@/domain/activities';
import type { PlacedReminder } from '@/domain/reminders/reconcile';

/** What the app is allowed to do, as the operating system sees it. */
export type NotificationPermission = 'granted' | 'denied' | 'undetermined';

/**
 * The thin edge between the app and the operating system's notifications.
 * Everything above this is testable without a device; below it is
 * expo-notifications, which only runs in a build on a phone.
 */
export type NotificationPort = {
  permission(): Promise<NotificationPermission>;
  /** Asks, if the system still allows asking. Returns what it ends up being. */
  request(): Promise<NotificationPermission>;
  /** What this phone is already holding for us. */
  placed(): Promise<PlacedReminder[]>;
  /** Places one and returns the handle the system gave it. */
  place(reminder: ScheduledReminder, text: { title: string; body: string }): Promise<string>;
  cancel(handle: string): Promise<void>;
};
