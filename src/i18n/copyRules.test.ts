import en from './en.json';

/**
 * SDD 12.3, rule 10 and ADR-006: the app records and summarises, and never
 * says what a number means. This walks every string that ships and fails on
 * the words that would turn a figure into a verdict — the thing that would
 * also drag the app inside EU MDR (SDD 12.2).
 *
 * A word is banned by what it does to a reader, not by spelling, so each
 * exception below names the string and why it is about the app rather than
 * about the baby.
 */
const NEVER = [
  { pattern: /\bnormal\b/i, why: 'calls a figure normal' },
  { pattern: /\bhealthy\b/i, why: 'calls a figure healthy' },
  { pattern: /\btoo (little|much|few|many|low|high|slow|fast)\b/i, why: 'judges an amount' },
  { pattern: /\bconcern(ing|ed)?\b/i, why: 'tells someone to be concerned' },
  { pattern: /\byour baby should\b/i, why: 'tells a baby what to do' },
  { pattern: /\byou should\b/i, why: 'gives advice' },
  { pattern: /\bwe recommend\b/i, why: 'gives advice' },
  { pattern: /\b(diagnos|symptom of|treat(ment|ing)?)\b/i, why: 'reads as clinical' },
  { pattern: /\b(good|bad|poor|worrying|alarming)\b/i, why: 'grades a figure' },
  { pattern: /\b(behind|ahead) (of )?(schedule|average|normal)\b/i, why: 'compares to a norm' },
  { pattern: /\bnot enough\b/i, why: 'says an amount falls short' },
];

/**
 * Strings that match a pattern but are about the app, not about the baby.
 * Each one is listed by key, so removing or reusing the key breaks this test
 * rather than quietly widening the exception.
 */
const ABOUT_THE_APP: Record<string, string> = {
  'signIn.problem.rate_limited':
    'counts sign-in attempts, which is the auth server refusing a request',
};

type Entry = { key: string; text: string };

function strings(node: unknown, path = ''): Entry[] {
  if (typeof node === 'string') return [{ key: path, text: node }];
  if (node === null || typeof node !== 'object') return [];
  return Object.entries(node as Record<string, unknown>).flatMap(([k, v]) =>
    strings(v, path === '' ? k : `${path}.${k}`),
  );
}

const all = strings(en);

describe('every user-facing string', () => {
  it('is checked by this test: the app ships one language and this reads all of it', () => {
    // A guard on the guard: if the file is ever restructured so the walk stops
    // finding strings, this fails instead of passing on an empty list.
    expect(all.length).toBeGreaterThan(300);
    expect(all.every((entry) => entry.key !== '' && entry.text !== '')).toBe(true);
  });

  it.each(NEVER)('never says what a number means: $why', ({ pattern }) => {
    const offenders = all
      .filter((entry) => pattern.test(entry.text))
      .filter((entry) => !(entry.key in ABOUT_THE_APP))
      .map((entry) => `${entry.key}: ${entry.text}`);
    expect(offenders).toEqual([]);
  });

  it('keeps every exception pointed at a string that still exists', () => {
    const keys = new Set(all.map((entry) => entry.key));
    for (const key of Object.keys(ABOUT_THE_APP)) expect(keys.has(key)).toBe(true);
  });

  it('keeps every exception actually matching something, so none rots', () => {
    for (const [key, why] of Object.entries(ABOUT_THE_APP)) {
      const entry = all.find((e) => e.key === key);
      expect(why.length).toBeGreaterThan(10);
      expect(NEVER.some(({ pattern }) => pattern.test(entry?.text ?? ''))).toBe(true);
    }
  });

  it('puts no health figure in a notification body (rule 8)', () => {
    const notifications = all.filter((entry) => entry.key.startsWith('notifications.'));
    for (const entry of notifications) {
      expect(entry.text).not.toMatch(/\{\{(ml|grams|celsius|temp|count|wet|dirty)\}\}/);
    }
  });
});
