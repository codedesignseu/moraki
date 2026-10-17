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
