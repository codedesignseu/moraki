import { resources } from '@/i18n';

import { EVENT_TYPES, listActivities } from '.';

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
// shipped locale. Extend this as later tasks make the rest of the contract
// required: summarize (P1-11 history rows), LogSheet (P1-07 onwards), icon
// (P1-06), and a round-trip fixture per module.
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
});
