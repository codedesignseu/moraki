// Test-only: the operating system's side of local notifications, in memory.
import type { ScheduledReminder } from '@/domain/activities';
import type { PlacedReminder } from '@/domain/reminders/reconcile';
import type { NotificationPermission, NotificationPort } from '@/notifications/port';

export type FakeNotifications = NotificationPort & {
  /** What the phone is holding, in the order it was placed. */
  held: () => (PlacedReminder & { title: string; body: string })[];
  /** Every call, so a test can prove nothing churned. */
  calls: string[];
  /** What the system answers when asked. */
  answer: (permission: NotificationPermission) => void;
};

export function createFakeNotifications(
  start: NotificationPermission = 'granted',
): FakeNotifications {
  const placed = new Map<string, PlacedReminder & { title: string; body: string }>();
  const calls: string[] = [];
  let permission: NotificationPermission = start;
  let answers: NotificationPermission = start;
  let next = 0;

  return {
    calls,
    held: () => [...placed.values()],
    answer: (value) => {
      answers = value;
    },
    permission: async () => permission,
    request: async () => {
      calls.push('request');
      permission = answers;
      return permission;
    },
    placed: async () => [...placed.values()],
    place: async (reminder: ScheduledReminder, text) => {
      next += 1;
      const handle = `os-${next}`;
      calls.push(`place ${reminder.id}@${reminder.at}`);
      placed.set(handle, {
        handle,
        id: reminder.id,
        category: reminder.category,
        at: reminder.at,
        bodyKey: reminder.bodyKey,
        ...(reminder.values ? { values: reminder.values } : {}),
        ...text,
      });
      return handle;
    },
    cancel: async (handle: string) => {
      calls.push(`cancel ${handle}`);
      placed.delete(handle);
    },
  };
}
