import {
  accessStatus,
  agreedToCurrent,
  CONSENT_VERSION,
  consentLocale,
  guardianStatus,
  legalLink,
  TERMS_VERSION,
  termsStatus,
} from './consent';

const USER = '0190a0b0-0000-7000-8000-000000000001';

describe('agreedToCurrent', () => {
  it('is true for this account agreeing to the version in force', () => {
    expect(agreedToCurrent({ userId: USER, version: CONSENT_VERSION }, USER)).toBe(true);
  });

  it('is false for an agreement to an older version, so the text is asked again', () => {
    expect(agreedToCurrent({ userId: USER, version: '2026-09-23' }, USER)).toBe(false);
  });

  it('is false for another account, nobody signed in, or no agreement', () => {
    const record = { userId: USER, version: CONSENT_VERSION };
    expect(agreedToCurrent(record, '0190a0b0-0000-7000-8000-000000000002')).toBe(false);
    expect(agreedToCurrent(record, null)).toBe(false);
    expect(agreedToCurrent(null, USER)).toBe(false);
  });
});

describe('consentLocale', () => {
  it('names the language the text was shown in', () => {
    expect(consentLocale('el')).toBe('el');
    expect(consentLocale('el-CY')).toBe('el');
    expect(consentLocale('en')).toBe('en');
  });

  it('falls back to English, as the app does, for a language with no text', () => {
    expect(consentLocale('fr')).toBe('en');
    expect(consentLocale('')).toBe('en');
  });
});

describe('guardianStatus', () => {
  const HOUSEHOLD = '0190a0b0-0000-7000-8000-0000000000a1';

  it('says what the server said for this account and household', () => {
    expect(
      guardianStatus({ userId: USER, householdId: HOUSEHOLD, onRecord: true }, USER, HOUSEHOLD),
    ).toBe('on_record');
    expect(
      guardianStatus({ userId: USER, householdId: HOUSEHOLD, onRecord: false }, USER, HOUSEHOLD),
    ).toBe('missing');
  });

  it('is unknown with no answer yet, or an answer about someone or somewhere else', () => {
    const record = { userId: USER, householdId: HOUSEHOLD, onRecord: false };
    expect(guardianStatus(null, USER, HOUSEHOLD)).toBe('unknown');
    expect(guardianStatus(record, '0190a0b0-0000-7000-8000-000000000002', HOUSEHOLD)).toBe(
      'unknown',
    );
    expect(guardianStatus(record, USER, '0190a0b0-0000-7000-8000-0000000000a2')).toBe('unknown');
    expect(guardianStatus(record, null, null)).toBe('unknown');
  });
});

describe('termsStatus', () => {
  it('is agreed for this account agreeing to the Terms in force', () => {
    expect(termsStatus({ userId: USER, version: TERMS_VERSION }, USER)).toBe('agreed');
  });

  it('is outdated after the Terms changed, so they are asked again', () => {
    expect(termsStatus({ userId: USER, version: '2026-01-01' }, USER)).toBe('outdated');
  });

  it('is none for another account, nobody signed in, or no agreement', () => {
    const record = { userId: USER, version: TERMS_VERSION };
    expect(termsStatus(record, '0190a0b0-0000-7000-8000-000000000002')).toBe('none');
    expect(termsStatus(record, null)).toBe('none');
    expect(termsStatus(null, USER)).toBe('none');
  });
});

describe('legalLink', () => {
  it('links the Greek page when the app is read in Greek', () => {
    expect(legalLink('terms', 'el')).toBe('https://moraki.app/el/terms/');
    expect(legalLink('privacy', 'en')).toBe('https://moraki.app/privacy/');
  });
});

describe('accessStatus', () => {
  const HOUSEHOLD = '0190a0b0-0000-7000-8000-0000000000a1';
  const record = {
    userId: USER,
    householdId: HOUSEHOLD,
    access: 'needs_agreement',
    isGuardian: false,
  } as const;

  it('says what the server said for this account and household', () => {
    expect(accessStatus(record, USER, HOUSEHOLD)).toBe('needs_agreement');
    expect(accessStatus({ ...record, access: 'granted' }, USER, HOUSEHOLD)).toBe('granted');
  });

  it('is unknown with no answer yet, or an answer about someone or somewhere else', () => {
    expect(accessStatus(null, USER, HOUSEHOLD)).toBe('unknown');
    expect(accessStatus(record, '0190a0b0-0000-7000-8000-000000000002', HOUSEHOLD)).toBe('unknown');
    expect(accessStatus(record, USER, '0190a0b0-0000-7000-8000-0000000000a2')).toBe('unknown');
    expect(accessStatus(record, null, null)).toBe('unknown');
  });
});
