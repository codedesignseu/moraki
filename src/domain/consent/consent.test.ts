import { agreedToCurrent, CONSENT_VERSION, consentLocale, guardianStatus } from './consent';

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
