import { z } from 'zod';

import type { ActivityModule } from './contract';

/** Stool-chart colours. Recorded as observed; nothing interprets them (rule 10). */
export const DIAPER_COLORS = ['yellow', 'green', 'brown', 'black', 'red', 'white'] as const;

export const diaperSchema = z.object({
  kind: z.enum(['wet', 'dirty', 'both']),
  color: z.enum(DIAPER_COLORS).optional(),
  note: z.string().max(280).optional(),
});

export type DiaperPayload = z.infer<typeof diaperSchema>;

export const diaperModule: ActivityModule<DiaperPayload> = {
  type: 'diaper',
  schema: diaperSchema,
  i18nKey: 'activity.diaper.label',
  contributes: {
    stats: (acc, e) => ({
      ...acc,
      wet: acc.wet + (e.payload.kind === 'dirty' ? 0 : 1),
      dirty: acc.dirty + (e.payload.kind === 'wet' ? 0 : 1),
    }),
  },
};
