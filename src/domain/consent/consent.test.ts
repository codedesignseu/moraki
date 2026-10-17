import { agreedToCurrent, CONSENT_VERSION } from './consent';

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
