/**
 * The consent policy this build asks about (SDD 12). It must match the
 * server's public.consent_version(). Bumping it asks everyone again: an
 * agreement to any other version counts as no agreement at all.
 */
export const CONSENT_VERSION = '2026-10-18';

/** What this phone remembers about an account's agreement. */
export type ConsentRecord = { userId: string; version: string };

/** Whether `userId` has agreed to the version in force, as this phone knows it. */
export function agreedToCurrent(consent: ConsentRecord | null, userId: string | null): boolean {
  return (
    consent !== null &&
    userId !== null &&
    consent.userId === userId &&
    consent.version === CONSENT_VERSION
  );
}

/** The languages a consent text exists in, as the server records them (P0.4). */
export type ConsentLocale = 'en' | 'el';

/**
 * The language a consent text was shown in, from the app's language: the
 * record names one exact text by its version and language. Anything the app
 * has no text for falls back to English, which is what i18n shows too.
 */
export function consentLocale(language: string): ConsentLocale {
  return language.split('-')[0] === 'el' ? 'el' : 'en';
}

/**
 * The guardian declaration this build shows when a household is created, or
 * when a member declares later (P0.1). The server records it with this
 * version; a new wording gets a new date.
 */
export const GUARDIAN_DECLARATION_VERSION = '2026-10-24';

/**
 * What this phone knows about whether an account's guardian declaration for
 * a household is on the server's record (P0.1). Owners from before the
 * declaration existed were marked as guardians without one, and are asked once.
 */
export type GuardianRecord = { userId: string; householdId: string; onRecord: boolean };

/**
 * `on_record` or `missing` once the server has said so for this account and
 * household; `unknown` before it has (or for another account's record), when
 * nothing is held back on a guess.
 */
export function guardianStatus(
  record: GuardianRecord | null,
  userId: string | null,
  householdId: string | null,
): 'on_record' | 'missing' | 'unknown' {
  if (!record || record.userId !== userId || record.householdId !== householdId) return 'unknown';
  return record.onRecord ? 'on_record' : 'missing';
}
