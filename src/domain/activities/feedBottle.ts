import { z } from 'zod';

import { takeMilk, type ActivityModule } from './contract';

export const feedBottleSchema = z.object({
  ml: z.int().min(1).max(400),
  milk: z.enum(['breast', 'formula', 'mixed']),
  from_stock: z.enum(['fridge', 'freezer']).optional(),
});

export type FeedBottlePayload = z.infer<typeof feedBottleSchema>;

export const feedBottleModule: ActivityModule<FeedBottlePayload> = {
  type: 'feed_bottle',
  schema: feedBottleSchema,
  i18nKey: 'activity.feed_bottle.label',
  historyGroup: 'feeds',
  summarize: (e) => ({
    key: `activity.feed_bottle.summary.${e.payload.milk}`,
    values: { ml: e.payload.ml },
  }),
  contributes: {
    stats: (acc, e) => ({
      ...acc,
      feedIds: [...acc.feedIds, e.groupId ?? e.id],
      ml: acc.ml + e.payload.ml,
    }),
    // A bottle poured from a store takes it from the oldest batch there.
    stock: (acc, e) =>
      e.payload.from_stock === undefined
        ? acc
        : takeMilk(acc, e.payload.from_stock, e.occurredAt, e.payload.ml),
  },
};
