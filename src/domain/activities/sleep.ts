import { z } from 'zod';

import { durationParts } from '../time/durationParts';
import type { ActivityModule } from './contract';

export const sleepSchema = z.object({
  place: z.enum(['crib', 'bassinet', 'arms', 'stroller', 'other']).optional(),
});

export type SleepPayload = z.infer<typeof sleepSchema>;

export const sleepModule: ActivityModule<SleepPayload> = {
  type: 'sleep',
  schema: sleepSchema,
  i18nKey: 'activity.sleep.label',
  icon: 'sleep',
  tone: 'sleep',
  historyGroup: 'sleep',
  quickAction: { tile: 'sleep' },
  summarize: (e) => {
    if (e.endedAt === null) return { key: 'activity.sleep.summary.running' };
    // G history: "Sleep 1 h 20", "Sleep 42 min". The words are copy in i18n.
    const { hours, minutes } = durationParts(e.endedAt - e.occurredAt);
    return hours === 0
      ? { key: 'activity.sleep.summary.minutes', values: { minutes } }
      : {
          key: 'activity.sleep.summary.hours',
          values: { hours, minutes: String(minutes).padStart(2, '0') },
        };
  },
};
