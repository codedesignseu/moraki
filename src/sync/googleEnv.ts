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
