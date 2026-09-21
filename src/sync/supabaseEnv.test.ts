import { parseSupabaseEnv, readSupabaseEnv, SupabaseEnvError } from './supabaseEnv';

// Obviously fake values: never put a real-looking key in a test.
const url = 'http://127.0.0.1:54321';
const publishable = 'sb_publishable_TEST';

describe('parseSupabaseEnv', () => {
  it('accepts a URL and a publishable key, trimming whitespace and trailing slashes', () => {
    expect(
      parseSupabaseEnv({
        EXPO_PUBLIC_SUPABASE_URL: ` ${url}/ `,
        EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: ` ${publishable}\n`,
      }),
    ).toEqual({ url, publishableKey: publishable });
  });

  it.each([
    [{}, /EXPO_PUBLIC_SUPABASE_URL is not set/],
    [{ EXPO_PUBLIC_SUPABASE_URL: '   ' }, /EXPO_PUBLIC_SUPABASE_URL is not set/],
    [{ EXPO_PUBLIC_SUPABASE_URL: 'localhost:54321' }, /not an http\(s\) URL/],
    [{ EXPO_PUBLIC_SUPABASE_URL: url }, /PUBLISHABLE_KEY is not set/],
  ])('rejects missing or malformed settings %#', (env, message) => {
    expect(() => parseSupabaseEnv(env)).toThrow(message);
  });

  it('refuses a secret key without echoing it', () => {
    const secret = 'sb_secret_TEST';
    let error: unknown;
    try {
      parseSupabaseEnv({
        EXPO_PUBLIC_SUPABASE_URL: url,
        EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: secret,
      });
    } catch (e) {
      error = e;
    }
    expect(error).toBeInstanceOf(SupabaseEnvError);
    expect((error as Error).message).toMatch(/secret key/);
    expect((error as Error).message).not.toContain(secret);
  });

  it('refuses a legacy anon JWT', () => {
    expect(() =>
      parseSupabaseEnv({
        EXPO_PUBLIC_SUPABASE_URL: url,
        EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'eyJhbGciOiJIUzI1NiJ9.TEST.TEST',
      }),
    ).toThrow(/not a legacy anon key/);
  });
});

describe('readSupabaseEnv', () => {
  const saved = { ...process.env };
  afterEach(() => {
    process.env = { ...saved };
  });

  it('reads the EXPO_PUBLIC_ variables', () => {
    process.env.EXPO_PUBLIC_SUPABASE_URL = url;
    process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY = publishable;
    expect(readSupabaseEnv()).toEqual({ url, publishableKey: publishable });
  });
});
