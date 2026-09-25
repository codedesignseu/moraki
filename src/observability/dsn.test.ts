import { parseSentrySettings, SentryEnvError } from './dsn';

const EU = 'https://examplekey@o123456.ingest.de.sentry.io/456';

describe('the Sentry DSN', () => {
  it('is off when there is none, which is every local and test build', () => {
    expect(parseSentrySettings({})).toBeNull();
    expect(parseSentrySettings({ EXPO_PUBLIC_SENTRY_DSN: '   ' })).toBeNull();
  });

  it('accepts an EU project', () => {
    expect(parseSentrySettings({ EXPO_PUBLIC_SENTRY_DSN: EU })).toEqual({
      dsn: EU,
      environment: 'production',
    });
  });

  it('refuses a project outside the EU (SDD 12.1)', () => {
    for (const dsn of [
      'https://examplekey@o123456.ingest.us.sentry.io/456',
      'https://examplekey@o123456.ingest.sentry.io/456',
      'https://examplekey@sentry.example.test/456',
    ]) {
      expect(() => parseSentrySettings({ EXPO_PUBLIC_SENTRY_DSN: dsn })).toThrow(SentryEnvError);
    }
    expect(() =>
      parseSentrySettings({
        EXPO_PUBLIC_SENTRY_DSN: 'https://examplekey@o123456.ingest.us.sentry.io/456',
      }),
    ).toThrow(/EU region/);
  });

  it('refuses something that is not a URL', () => {
    expect(() => parseSentrySettings({ EXPO_PUBLIC_SENTRY_DSN: 'not-a-dsn' })).toThrow(/not a URL/);
  });

  it('never echoes the DSN in the message, so a log cannot hold it', () => {
    try {
      parseSentrySettings({ EXPO_PUBLIC_SENTRY_DSN: 'https://secretkey@o1.ingest.us.sentry.io/2' });
      throw new Error('expected it to be refused');
    } catch (thrown) {
      expect((thrown as Error).message).not.toContain('secretkey');
    }
  });

  it('takes the environment when the build names one', () => {
    expect(
      parseSentrySettings({ EXPO_PUBLIC_SENTRY_DSN: EU, EXPO_PUBLIC_SENTRY_ENV: 'preview' }),
    ).toEqual({ dsn: EU, environment: 'preview' });
  });
});
