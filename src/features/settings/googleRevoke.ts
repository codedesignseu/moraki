import { readGoogleIosClientId, readGoogleWebClientId } from '@/sync/googleEnv';

/**
 * Disconnects Moraki from the person's Google account when they delete their
 * Moraki account (P0.10): revokes the access Google granted at sign in, then
 * signs the Google SDK out on this phone.
 *
 * Best effort, and never a reason not to delete. Unlike Apple, Google doesn't
 * require it, and the server side of the account is gone either way. It only
 * works on a phone where Google sign in was used: the SDK has nothing to
 * revoke elsewhere, and asking the person to sign in to Google again just to
 * disconnect would be odd. Nothing about a failure is logged (rule 8).
 *
 * The package is required lazily, like in `features/auth/socialSignIn.ts`:
 * it throws at import time in any build the native module isn't linked into.
 */
export async function revokeGoogleAccess(
  webClientId: string | undefined = readGoogleWebClientId(),
  iosClientId: string | undefined = readGoogleIosClientId(),
): Promise<void> {
  if (!webClientId) return;
  let google: GoogleSigninApi;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    google = require('@react-native-google-signin/google-signin').GoogleSignin as GoogleSigninApi;
    google.configure(iosClientId ? { webClientId, iosClientId } : { webClientId });
    if (!google.hasPreviousSignIn()) return;
  } catch {
    return;
  }
  try {
    // revokeAccess needs the SDK's current user, which a fresh launch restores silently.
    if (google.getCurrentUser() === null) await google.signInSilently();
    await google.revokeAccess();
  } catch {
    // Offline, or Google refused: the account is deleted regardless.
  }
  try {
    await google.signOut();
  } catch {
    // Nothing to report.
  }
}

/** The part of GoogleSignin this uses; typed here so the lazy require stays typed. */
type GoogleSigninApi = {
  configure(options: { webClientId: string; iosClientId?: string }): void;
  hasPreviousSignIn(): boolean;
  getCurrentUser(): unknown;
  signInSilently(): Promise<unknown>;
  revokeAccess(): Promise<unknown>;
  signOut(): Promise<unknown>;
};
