import el from './el.json';
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
const NEVER_EN = [
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
 * The same rule in Greek (P4-04). A translation can break rule 10 while every
 * English string obeys it, so the Greek copy is read by its own list rather
 * than trusted. `φυσιολογικό` is the one that matters most: it is how Greek
 * says "normal" about a measurement, and it is exactly the verdict this app
 * never gives. Advice is banned in its future form (`θα πρέπει`), so copy
 * about an entry — "a sleep has to end after it starts" — still reads plainly.
 */
const NEVER_EL = [
  { pattern: /(φυσιολογικ|κανονικ)\w*/i, why: 'calls a figure normal' },
  { pattern: /υγι(ής|ές|ή|ειν)\w*/i, why: 'calls a figure healthy' },
  { pattern: /πάρα πολλ\w*/i, why: 'judges an amount' },
  { pattern: /πολύ (λίγ|λιγ|μικρ|μεγάλ|χαμηλ|υψηλ)\w*/i, why: 'judges an amount' },
  { pattern: /ανησυχητικ\w*/i, why: 'tells someone to be concerned' },
  { pattern: /θα πρέπει/i, why: 'gives advice' },
  { pattern: /συνιστ(ούμε|άται)/i, why: 'gives advice' },
  { pattern: /(διάγνωσ|σύμπτωμα|συμπτώμα|θεραπεί)\w*/i, why: 'reads as clinical' },
  { pattern: /(ανεπαρκ|υπερβολικ|φτωχ)\w*/i, why: 'grades a figure' },
  { pattern: /(πίσω|μπροστά) από (τον )?(μέσο όρο|το φυσιολογικό)/i, why: 'compares to a norm' },
] as const;

/** Each shipped language, with the list its copy is read against. */
const LANGUAGES = [
  { language: 'en', copy: en, never: NEVER_EN },
  { language: 'el', copy: el, never: NEVER_EL },
] as const;

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

describe.each(LANGUAGES)('every user-facing string in $language', ({ copy, never }) => {
  const all = strings(copy);

  it('is checked by this test: every string that ships in this language is read', () => {
    // A guard on the guard: if the file is ever restructured so the walk stops
    // finding strings, this fails instead of passing on an empty list.
    expect(all.length).toBeGreaterThan(300);
    expect(all.every((entry) => entry.key !== '' && entry.text !== '')).toBe(true);
  });

  it.each(never)('never says what a number means: $why', ({ pattern }) => {
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
      expect(never.some(({ pattern }) => pattern.test(entry?.text ?? ''))).toBe(true);
    }
  });

  it('puts no health figure in a notification body (rule 8)', () => {
    const notifications = all.filter((entry) => entry.key.startsWith('notifications.'));
    for (const entry of notifications) {
      expect(entry.text).not.toMatch(/\{\{(ml|grams|celsius|temp|count|wet|dirty)\}\}/);
    }
  });
});

describe('the Greek locale', () => {
  const english = strings(en);
  const greek = new Map(strings(el).map((entry) => [entry.key, entry.text]));

  it('translates every English string, so nothing falls back mid-screen', () => {
    const untranslated = english.filter((entry) => !greek.has(entry.key)).map((e) => e.key);
    expect(untranslated).toEqual([]);
  });

  it('keeps every interpolation, so no figure goes missing from a sentence', () => {
    const placeholders = (text: string) =>
      [...text.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]).sort();
    for (const entry of english) {
      expect(placeholders(greek.get(entry.key) ?? '')).toEqual(placeholders(entry.text));
    }
  });

  it('is actually Greek, not English copied across', () => {
    const translated = english.filter((entry) => greek.get(entry.key) !== entry.text);
    // Names, units and pure interpolations are the same in both, so this is a
    // proportion rather than a count: most of the copy has to have changed.
    expect(translated.length / english.length).toBeGreaterThan(0.9);
  });
});
