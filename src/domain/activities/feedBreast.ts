import { z } from 'zod';

import type { ActivityModule, Event } from './contract';

export const feedBreastSchema = z.object({
  side: z.enum(['left', 'right', 'both']),
  // Seconds on each side. SDD 4.1 says int; a negative duration is never valid.
  left_s: z.int().min(0).optional(),
  right_s: z.int().min(0).optional(),
});

export type FeedBreastPayload = z.infer<typeof feedBreastSchema>;

/**
 * Time spent breastfeeding: the per-side seconds when they were recorded
 * (pauses excluded), otherwise start to end. A feed with neither, such as one
 * logged without a duration, counts as 0 rather than a guess.
 */
export function breastDurationMs(e: Event<FeedBreastPayload>): number {
  const { left_s, right_s } = e.payload;
  if (left_s !== undefined || right_s !== undefined) return ((left_s ?? 0) + (right_s ?? 0)) * 1000;
  return e.endedAt === null ? 0 : Math.max(0, e.endedAt - e.occurredAt);
}

export const feedBreastModule: ActivityModule<FeedBreastPayload> = {
  type: 'feed_breast',
  schema: feedBreastSchema,
  i18nKey: 'activity.feed_breast.label',
  historyGroup: 'feeds',
  summarize: (e) => ({ key: `activity.feed_breast.summary.${e.payload.side}` }),
  contributes: {
    stats: (acc, e) => ({
      ...acc,
      feedIds: [...acc.feedIds, e.groupId ?? e.id],
      breastMs: acc.breastMs + breastDurationMs(e),
    }),
  },
};
