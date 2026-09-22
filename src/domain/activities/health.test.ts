import { healthModule, parseTemperature } from './health';
import type { Event } from './contract';

describe('parseTemperature', () => {
  it.each([
    ['', { kind: 'empty' }],
    ['   ', { kind: 'empty' }],
    ['37.8', { kind: 'value', celsius: 37.8 }],
    ['37,8', { kind: 'value', celsius: 37.8 }],
    [' 36 ', { kind: 'value', celsius: 36 }],
    ['36.', { kind: 'value', celsius: 36 }],
    ['37.85', { kind: 'value', celsius: 37.9 }],
    ['34', { kind: 'value', celsius: 34 }],
    ['43.0', { kind: 'value', celsius: 43 }],
    ['33.9', { kind: 'out_of_range' }],
    ['43.1', { kind: 'out_of_range' }],
    ['99', { kind: 'out_of_range' }],
    ['abc', { kind: 'not_a_number' }],
    ['37.5.1', { kind: 'not_a_number' }],
    ['-37', { kind: 'not_a_number' }],
    ['100', { kind: 'not_a_number' }],
  ])('%p is %o', (input, expected) => {
    expect(parseTemperature(input)).toEqual(expected);
  });
});

describe('health summary', () => {
  const event = (payload: { note: string; temp_c?: number }): Event<typeof payload> => ({
    id: 'e',
    householdId: 'h',
    babyId: 'b',
    type: 'health',
    occurredAt: 0,
    endedAt: null,
    payload,
    groupId: null,
    createdBy: 'u',
    updatedBy: 'u',
    clientCreatedAt: 0,
    deletedAt: null,
  });

  it('shows the temperature when there is one', () => {
    expect(healthModule.summarize?.(event({ note: 'x', temp_c: 38 }))).toEqual({
      key: 'activity.health.summary.temp',
      values: { temp: '38.0' },
    });
  });

  it('otherwise shows the first line of the note, shortened', () => {
    const long = `${'a'.repeat(70)}\nsecond line`;
    const summary = healthModule.summarize?.(event({ note: long }));
    expect(summary?.values?.note).toBe(`${'a'.repeat(59)}…`);
    expect(healthModule.summarize?.(event({ note: 'Rash\nmore' }))?.values?.note).toBe('Rash');
  });
});
