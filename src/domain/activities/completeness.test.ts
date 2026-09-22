import { resources } from '@/i18n';

import { EVENT_TYPES, listActivities, type Event, type EventType } from '.';

/** Walks a dotted key through a locale's nested JSON. */
function lookup(locale: unknown, key: string): unknown {
  return key
    .split('.')
    .reduce<unknown>(
      (node, part) =>
        node !== null && typeof node === 'object'
          ? (node as Record<string, unknown>)[part]
          : undefined,
      locale,
    );
}

// SDD 15.3. Scoped to what P1-01 populates: a schema and an i18n key in every
// shipped locale. The rest of the contract is optional in ActivityModule<P>
// until every module has it; the tasks expected to fill each field (from
// docs/TASKS.md) are below. When a field's last task lands, make it required
// in contract.ts and add its check here.
//
// icon       P1-06 defines IconName for the home grid; every type needs one
//            by P1-11, since history rows show all types.
// summarize  P1-06 home recent list first (bottle, breast, diaper, sleep),
//            health and medication from P1-10;
//            every type by P1-11 history. Checked below for modules that have it.
// LogSheet   feed_bottle, feed_breast P1-07 · diaper P1-08 · sleep P1-09 ·
//            health, medication P1-10 · pump P3-02 · stock_adjust P3-03 ·
//            weight P3-05 · appointment P3-12 (last: required from P3-12).
// fixture    a round-trip fixture per module (15.3); no task owns it yet.
describe('activity registry completeness', () => {
  const modules = listActivities();

  it('registers exactly one module for every event type', () => {
    expect(modules.map((m) => m.type).sort()).toEqual([...EVENT_TYPES].sort());
  });

  it.each(modules.map((m) => [m.type, m] as const))('%s has a schema', (_type, module) => {
    expect(typeof module.schema.safeParse).toBe('function');
  });

  const locales = Object.entries(resources).map(
    ([lang, { translation }]) => [lang, translation] as const,
  );

  it.each(
    modules.flatMap((m) =>
      locales.map(([lang, translation]) => [m.type, lang, m.i18nKey, translation] as const),
    ),
  )('%s label exists in %s', (_type, _lang, key, translation) => {
    const label = lookup(translation, key);
    expect(typeof label).toBe('string');
    expect(label).not.toBe('');
  });
  // Payloads covering every summary variant of the modules that summarize.
  const variants: Partial<Record<EventType, [unknown, number | null][]>> = {
    feed_bottle: ['breast', 'formula', 'mixed'].map((milk) => [{ ml: 90, milk }, null]),
    feed_breast: ['left', 'right', 'both'].map((side) => [{ side }, null]),
    diaper: ['wet', 'dirty', 'both'].map((kind) => [{ kind }, null]),
    health: [
      [{ note: 'Warm', temp_c: 37.8 }, null],
      [{ note: 'Rash on cheek' }, null],
      [{ temp_c: 37.2 }, null],
    ],
    medication: [
      [{ name: 'Vitamin D', dose: '1 drop' }, null],
      [{ name: 'Vitamin D' }, null],
    ],
    sleep: [
      [{}, null],
      [{}, 3_600_000],
    ],
  };
  const summaries = modules.flatMap((m) =>
    m.summarize
      ? (variants[m.type] ?? []).flatMap(([payload, endedAt]) => {
          const event: Event<unknown> = {
            id: 'e',
            householdId: 'h',
            babyId: 'b',
            type: m.type,
            occurredAt: 0,
            endedAt,
            payload: m.schema.parse(payload),
            groupId: null,
            createdBy: 'u',
            updatedBy: 'u',
            clientCreatedAt: 0,
            deletedAt: null,
          };
          const { key } = m.summarize?.(event) ?? { key: '' };
          return locales.map(([lang, translation]) => [m.type, key, lang, translation] as const);
        })
      : [],
  );

  it('has summary fixtures for every module that summarizes', () => {
    const summarizing = modules.filter((m) => m.summarize).map((m) => m.type);
    expect(summarizing.filter((type) => !variants[type])).toEqual([]);
  });

  it.each(summaries)('%s summary %s exists in %s', (_type, key, _lang, translation) => {
    const text = lookup(translation, key);
    expect(typeof text).toBe('string');
    expect(text).not.toBe('');
  });
});
