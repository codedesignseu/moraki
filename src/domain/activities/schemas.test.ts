import type { ZodType } from 'zod';

import { appointmentSchema } from './appointment';
import type { EventType } from './contract';
import { diaperSchema } from './diaper';
import { feedBottleSchema } from './feedBottle';
import { feedBreastSchema } from './feedBreast';
import { healthSchema } from './health';
import { medicationSchema } from './medication';
import { pumpSchema } from './pump';
import { sleepSchema } from './sleep';
import { stockAdjustSchema } from './stockAdjust';
import { weightSchema } from './weight';

type Cases = {
  schema: ZodType;
  valid: [string, unknown][];
  invalid: [string, unknown][];
};

const long = (n: number) => 'x'.repeat(n);

// One entry per SDD 4.1 type. Invalid cases hit each constraint just past its edge.
const cases: Record<EventType, Cases> = {
  feed_bottle: {
    schema: feedBottleSchema,
    valid: [
      ['minimum ml', { ml: 1, milk: 'formula' }],
      ['maximum ml', { ml: 400, milk: 'breast' }],
      ['from stock', { ml: 90, milk: 'mixed', from_stock: 'freezer' }],
    ],
    invalid: [
      ['ml 0', { ml: 0, milk: 'formula' }],
      ['ml 401', { ml: 401, milk: 'formula' }],
      ['ml 500', { ml: 500, milk: 'formula' }],
      ['fractional ml', { ml: 90.5, milk: 'formula' }],
      ['unknown milk', { ml: 90, milk: 'cow' }],
      ['unknown stock location', { ml: 90, milk: 'breast', from_stock: 'counter' }],
      ['missing milk', { ml: 90 }],
    ],
  },
  feed_breast: {
    schema: feedBreastSchema,
    valid: [
      ['side only', { side: 'left' }],
      ['both with durations', { side: 'both', left_s: 600, right_s: 0 }],
    ],
    invalid: [
      ['unknown side', { side: 'middle' }],
      ['negative seconds', { side: 'left', left_s: -1 }],
      ['fractional seconds', { side: 'right', right_s: 12.5 }],
      ['missing side', {}],
    ],
  },
  diaper: {
    schema: diaperSchema,
    valid: [
      ['wet', { kind: 'wet' }],
      ['dirty with colour and note', { kind: 'dirty', color: 'yellow', note: long(280) }],
      ['every colour', { kind: 'both', color: 'white' }],
    ],
    invalid: [
      ['unknown kind', { kind: 'dry' }],
      ['unknown colour', { kind: 'dirty', color: 'purple' }],
      ['note 281 chars', { kind: 'wet', note: long(281) }],
    ],
  },
  sleep: {
    schema: sleepSchema,
    valid: [
      ['no place', {}],
      ['bassinet', { place: 'bassinet' }],
    ],
    invalid: [
      ['unknown place', { place: 'car' }],
      ['non-string place', { place: 1 }],
    ],
  },
  pump: {
    schema: pumpSchema,
    valid: [
      ['minimum ml', { ml: 1, dest: 'fridge' }],
      ['maximum ml', { ml: 600, dest: 'fed' }],
    ],
    invalid: [
      ['ml 0', { ml: 0, dest: 'fridge' }],
      ['ml 601', { ml: 601, dest: 'freezer' }],
      ['unknown dest', { ml: 100, dest: 'sink' }],
    ],
  },
  stock_adjust: {
    schema: stockAdjustSchema,
    valid: [
      ['discard', { loc: 'fridge', delta_ml: -120, reason: 'discard' }],
      ['correction up', { loc: 'freezer', delta_ml: 60, reason: 'correction' }],
    ],
    invalid: [
      ['fractional delta', { loc: 'fridge', delta_ml: -1.5, reason: 'discard' }],
      ['unknown location', { loc: 'bag', delta_ml: 10, reason: 'move' }],
      ['unknown reason', { loc: 'fridge', delta_ml: 10, reason: 'spilled' }],
    ],
  },
  health: {
    schema: healthSchema,
    valid: [
      ['note only', { note: 'x' }],
      ['temperature edges', { note: long(500), temp_c: 34 }],
      ['upper temperature', { note: 'hot', temp_c: 43, tags: ['cough', 'fussy'] }],
      ['temperature only (P1-F9)', { temp_c: 37.2 }],
      ['temperature only with tags', { temp_c: 38, tags: ['cough'] }],
    ],
    invalid: [
      ['empty note', { note: '' }],
      ['neither note nor temperature', {}],
      ['tags only', { tags: ['rash'] }],
      ['note 501 chars', { note: long(501) }],
      ['temperature 33.9', { note: 'cold', temp_c: 33.9 }],
      ['temperature 43.1', { note: 'hot', temp_c: 43.1 }],
      ['unknown tag', { note: 'x', tags: ['sneeze'] }],
    ],
  },
  medication: {
    schema: medicationSchema,
    valid: [
      ['name only', { name: 'Vitamin D' }],
      ['name and dose at caps', { name: long(60), dose: long(30) }],
    ],
    invalid: [
      ['empty name', { name: '' }],
      ['name 61 chars', { name: long(61) }],
      ['dose 31 chars', { name: 'Vitamin D', dose: long(31) }],
    ],
  },
  weight: {
    schema: weightSchema,
    valid: [
      ['minimum grams', { grams: 500, source: 'clinic' }],
      ['maximum grams', { grams: 15000, source: 'home' }],
    ],
    invalid: [
      ['grams 100', { grams: 100, source: 'home' }],
      ['grams 499', { grams: 499, source: 'home' }],
      ['grams 15001', { grams: 15001, source: 'clinic' }],
      ['fractional grams', { grams: 3400.5, source: 'home' }],
      ['unknown source', { grams: 3400, source: 'pharmacy' }],
    ],
  },
  appointment: {
    schema: appointmentSchema,
    valid: [
      ['title only', { title: 'Check-up' }],
      [
        'every field at caps',
        {
          title: long(100),
          doctor: long(60),
          clinic: long(80),
          notes: long(500),
          questions: Array.from({ length: 20 }, () => long(200)),
        },
      ],
    ],
    invalid: [
      ['empty title', { title: '' }],
      ['title 101 chars', { title: long(101) }],
      ['doctor 61 chars', { title: 'Visit', doctor: long(61) }],
      ['clinic 81 chars', { title: 'Visit', clinic: long(81) }],
      ['notes 501 chars', { title: 'Visit', notes: long(501) }],
      ['21 questions', { title: 'Visit', questions: Array.from({ length: 21 }, () => 'q') }],
      ['empty question', { title: 'Visit', questions: [''] }],
      ['question 201 chars', { title: 'Visit', questions: [long(201)] }],
    ],
  },
};

describe.each(Object.entries(cases))('%s payload', (_type, { schema, valid, invalid }) => {
  it.each(valid)('accepts %s', (_name, payload) => {
    expect(schema.safeParse(payload).success).toBe(true);
  });

  it.each(invalid)('rejects %s', (_name, payload) => {
    expect(schema.safeParse(payload).success).toBe(false);
  });

  it('rejects a non-object payload', () => {
    expect(schema.safeParse(null).success).toBe(false);
  });
});
