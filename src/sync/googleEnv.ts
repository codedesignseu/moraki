import Constants from 'expo-constants';

/**
 * The Google web client ID (Google Cloud Console > Credentials), needed on
 * both platforms to get back an ID token Supabase's Google provider will
 * accept (P5-04, EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID). Its own module, read
 * lazily like `readSupabaseEnv` in `auth.ts`: a build that hasn't been given
 * one yet just doesn't offer the Google button, the same as sign in itself
 * disappearing without Supabase settings.
 */
export function readGoogleWebClientId(): string | undefined {
  return process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
}

const SCHEME_PREFIX = 'com.googleusercontent.apps.';
const GOOGLE_SIGN_IN_PLUGIN = '@react-native-google-signin/google-signin';

/**
 * The iOS OAuth client ID from its reversed form, the URL scheme the
 * google-signin config plugin registers: `com.googleusercontent.apps.X`
 * becomes `X.apps.googleusercontent.com`. Undefined for anything else.
 */
export function iosClientIdFromUrlScheme(scheme: string | undefined): string | undefined {
  if (!scheme?.startsWith(SCHEME_PREFIX)) return undefined;
  const id = scheme.slice(SCHEME_PREFIX.length);
  return id ? `${id}.apps.googleusercontent.com` : undefined;
}

/**
 * The iOS client ID for Google sign in (P5-F9). On iOS the native module
 * refuses to configure without one ("failed to determine clientID"), and
 * this app ships no GoogleService-Info.plist. It is read from `app.json`'s
 * own `iosUrlScheme`, so the two can never disagree. Not a secret: the
 * scheme is in every build's Info.plist.
 */
export function readGoogleIosClientId(
  plugins: unknown = Constants.expoConfig?.plugins,
): string | undefined {
  if (!Array.isArray(plugins)) return undefined;
  for (const plugin of plugins) {
    if (Array.isArray(plugin) && plugin[0] === GOOGLE_SIGN_IN_PLUGIN) {
      const options = plugin[1] as { iosUrlScheme?: unknown } | undefined;
      return iosClientIdFromUrlScheme(
        typeof options?.iosUrlScheme === 'string' ? options.iosUrlScheme : undefined,
      );
    }
  }
  return undefined;
}
