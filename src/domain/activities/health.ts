import { z } from 'zod';

import type { ActivityModule } from './contract';

/** Observations only, no severity. Recorded, never interpreted (rule 10). */
export const HEALTH_TAGS = [
  'rash',
  'vomiting',
  'cough',
  'congestion',
  'fussy',
  'jaundice',
  'other',
] as const;

/** SDD 4.1 limits, shared by the schema and the sheet's validation. */
export const HEALTH_NOTE_MAX = 500;
export const TEMP_C = { min: 34, max: 43 } as const;

/**
 * A note, a temperature, or both: an entry with neither records nothing. This
 * relaxes SDD 4.1, where the note was always required, so a temperature can be
 * logged on its own (P1-F9).
 */
export const healthSchema = z
  .object({
    note: z.string().min(1).max(HEALTH_NOTE_MAX).optional(),
    temp_c: z.number().min(TEMP_C.min).max(TEMP_C.max).optional(),
    tags: z.array(z.enum(HEALTH_TAGS)).optional(),
  })
  .refine((p) => p.note !== undefined || p.temp_c !== undefined);

export type HealthPayload = z.infer<typeof healthSchema>;

export const healthModule: ActivityModule<HealthPayload> = {
  type: 'health',
  schema: healthSchema,
  i18nKey: 'activity.health.label',
  summarize: (e) =>
    e.payload.temp_c === undefined
      ? { key: 'activity.health.summary.note', values: { note: preview(e.payload.note ?? '') } }
      : { key: 'activity.health.summary.temp', values: { temp: e.payload.temp_c.toFixed(1) } },
};

const PREVIEW_CHARS = 60;

/** First line of a note, shortened for a one-line row. */
function preview(note: string): string {
  const line = note.split('\n')[0]?.trim() ?? '';
  return line.length > PREVIEW_CHARS ? `${line.slice(0, PREVIEW_CHARS - 1)}…` : line;
}

export type TemperatureInput =
  | { kind: 'empty' }
  | { kind: 'value'; celsius: number }
  | { kind: 'not_a_number' }
  | { kind: 'out_of_range' };

/**
 * Reads a typed temperature in °C. Accepts a decimal point or comma (37.8 or
 * 37,8), rounds to one decimal, and checks SDD 4.1's 34 to 43 range. Nothing
 * here interprets the value (rule 10): out of range only means not recordable.
 */
export function parseTemperature(input: string): TemperatureInput {
  const text = input.trim().replace(',', '.');
  if (text === '') return { kind: 'empty' };
  if (!/^\d{1,2}(\.\d*)?$/.test(text)) return { kind: 'not_a_number' };
  const celsius = Math.round(Number(text) * 10) / 10;
  if (celsius < TEMP_C.min || celsius > TEMP_C.max) return { kind: 'out_of_range' };
  return { kind: 'value', celsius };
}
