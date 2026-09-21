export type SupabaseEnv = {
  url: string;
  publishableKey: string;
};

type RawEnv = {
  EXPO_PUBLIC_SUPABASE_URL?: string | undefined;
  EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY?: string | undefined;
};

export class SupabaseEnvError extends Error {
  override name = 'SupabaseEnvError';
}

/**
 * Validates the Supabase settings the app bundle is allowed to carry.
 * Only the new-format publishable key (`sb_publishable_…`) is accepted: a
 * secret key must never ship in an app, and legacy anon JWTs are not used.
 * Messages never echo the value, so a misplaced secret can't end up in a log.
 */
export function parseSupabaseEnv(env: RawEnv): SupabaseEnv {
  const url = env.EXPO_PUBLIC_SUPABASE_URL?.trim();
  const publishableKey = env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();

  if (!url) {
    throw new SupabaseEnvError('EXPO_PUBLIC_SUPABASE_URL is not set. See .env.example.');
  }
  if (!/^https?:\/\/[^\s/]+/.test(url)) {
    throw new SupabaseEnvError('EXPO_PUBLIC_SUPABASE_URL is not an http(s) URL.');
  }
  if (!publishableKey) {
    throw new SupabaseEnvError(
      'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY is not set. See .env.example.',
    );
  }
  if (publishableKey.startsWith('sb_secret_')) {
    throw new SupabaseEnvError(
      'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY holds a secret key. Secret keys must never be in the app bundle; rotate it.',
    );
  }
  if (!publishableKey.startsWith('sb_publishable_')) {
    throw new SupabaseEnvError(
      'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY must be a publishable key (sb_publishable_…), not a legacy anon key.',
    );
  }
  return { url: url.replace(/\/+$/, ''), publishableKey };
}

/**
 * Reads the Supabase settings Expo inlined at build time. Each variable is
 * referenced by its full literal name because Expo only inlines
 * `process.env.EXPO_PUBLIC_*` written out that way. Called lazily by sync and
 * auth, never at startup: the app works offline without these.
 */
export function readSupabaseEnv(): SupabaseEnv {
  return parseSupabaseEnv({
    EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL,
    EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  });
}
