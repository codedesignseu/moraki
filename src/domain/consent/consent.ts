/**
 * The consent policy this build asks about (SDD 12). It must match the
 * server's public.consent_version(). Bumping it asks everyone again: an
 * agreement to any other version counts as no agreement at all. Since P0.2
 * it is the parent's or guardian's consent, for the baby. 2026-10-25 says
 * what withdrawing does to the household (P0.3).
 */
export const CONSENT_VERSION = '2026-10-25';

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

/**
 * The Terms of Use and Privacy Policy this build shows (P0.9), as dated on
 * moraki.app. Bumping TERMS_VERSION asks every signed-in account to agree
 * again before their entries sync (P1.4).
 */
export const TERMS_VERSION = '2026-10-24';
export const PRIVACY_VERSION = '2026-10-24';

/** What this phone remembers about an account agreeing to the Terms. */
export type TermsRecord = { userId: string; version: string };

/**
 * Where `userId` stands with the Terms in force, as this phone knows it:
 * agreed, agreed to an older version (so "We updated our Terms"), or never.
 */
export function termsStatus(
  record: TermsRecord | null,
  userId: string | null,
): 'agreed' | 'outdated' | 'none' {
  if (!record || userId === null || record.userId !== userId) return 'none';
  return record.version === TERMS_VERSION ? 'agreed' : 'outdated';
}

/**
 * The caregiver agreement this build shows (P0.2): what someone who isn't the
 * baby's parent or guardian accepts before seeing a household. It must match
 * the server's public.caregiver_agreement_version().
 */
export const CAREGIVER_AGREEMENT_VERSION = '2026-10-24';

/**
 * What the server says this account may do with its household's baby data
 * (P0.2, `my_membership_status`): `granted`, or which agreement is missing.
 * A guardian is asked for health-data consent; anyone else for the caregiver
 * agreement. `frozen` (P0.3): no guardian in the household has consent in
 * force, so nobody may see or send its baby data until one does.
 */
export type HouseholdAccess = 'granted' | 'needs_consent' | 'needs_agreement' | 'frozen';

/** The phone's copy of that answer, for one account and household. */
export type AccessRecord = {
  userId: string;
  householdId: string;
  access: HouseholdAccess;
  isGuardian: boolean;
};

/**
 * The answer for this account and household, or `unknown` before the server
 * has given one (or for another account's record). Nothing is sent on a guess.
 */
export function accessStatus(
  record: AccessRecord | null,
  userId: string | null,
  householdId: string | null,
): HouseholdAccess | 'unknown' {
  if (!record || record.userId !== userId || record.householdId !== householdId) return 'unknown';
  return record.access;
}

/** The pages on moraki.app (P5-06), in Greek when the app is read in Greek. */
export function legalLink(page: 'privacy' | 'terms' | 'support', language: string): string {
  return `https://moraki.app${language.startsWith('el') ? '/el' : ''}/${page}/`;
}
