import { z } from 'zod';

import type { ActivityModule } from './contract';

export const weightSchema = z.object({
  grams: z.int().min(500).max(15000),
  source: z.enum(['home', 'clinic']),
});

export type WeightPayload = z.infer<typeof weightSchema>;

export const weightModule: ActivityModule<WeightPayload> = {
  type: 'weight',
  schema: weightSchema,
  i18nKey: 'activity.weight.label',
  historyGroup: 'other',
};

/** What a weight may be, in grams: the same bounds the schema accepts. */
export const WEIGHT_G = { step: 10, min: 500, max: 15000 } as const;

/** Plain digits, or groups of three as any locale writes them: 4 120, 4,120, 4.120. */
const GRAMS = /^(?:\d+|\d{1,3}(?:[ ,.'\u00a0]\d{3})+)$/;

/**
 * Reads a weight someone typed, in whole grams.
 *
 * Scales read whole grams, so there is no decimal point to take — which also
 * means a stray one cannot turn 4.12 kg into 412 g: a separator counts only
 * where three digits follow it. Anything outside the range comes back null
 * rather than clamped, because quietly turning a typed 450 into 500 puts a
 * number in the log that nobody entered.
 */
export function parseGrams(text: string): number | null {
  const trimmed = text.trim();
  if (trimmed === '' || !GRAMS.test(trimmed)) return null;
  const grams = Number(trimmed.replace(/[ ,.' ]/g, ''));
  if (!Number.isInteger(grams) || grams < WEIGHT_G.min || grams > WEIGHT_G.max) return null;
  return grams;
}
