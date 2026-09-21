import { z } from 'zod';

import type { ActivityModule } from './contract';

export const feedBreastSchema = z.object({
  side: z.enum(['left', 'right', 'both']),
  // Seconds on each side. SDD 4.1 says int; a negative duration is never valid.
  left_s: z.int().min(0).optional(),
  right_s: z.int().min(0).optional(),
});

export type FeedBreastPayload = z.infer<typeof feedBreastSchema>;

export const feedBreastModule: ActivityModule<FeedBreastPayload> = {
  type: 'feed_breast',
  schema: feedBreastSchema,
  i18nKey: 'activity.feed_breast.label',
};
