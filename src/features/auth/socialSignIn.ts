import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';

/**
 * Thrown when the person dismisses the native sheet without choosing an
 * account. Not a failure to report — the sign-in screen just goes back to
 * idle, the same as pressing "not now" on the email code screen.
 */
export class SocialSignInCancelled extends Error {
  override name = 'SocialSignInCancelled';
}

/** iOS 13+ only; the screen checks this before it offers the Apple button at all. */
export const isAppleSignInAvailable = (): Promise<boolean> =>
  AppleAuthentication.isAvailableAsync();

/**
 * Native "Sign in with Apple" (P5-04). Apple's identity token carries a
 * `nonce` claim equal to the SHA-256 of whatever we ask it to sign; Supabase
 * verifies the token against the *original* string on the other end, so both
 * forms have to travel: the hash to Apple's sheet, the original alongside
 * the token to `Auth.signInWithIdToken`.
 */
export async function signInWithApple(): Promise<{ identityToken: string; nonce: string }> {
  const nonce = Crypto.randomUUID();
  const hashedNonce = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, nonce);
  try {
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
      nonce: hashedNonce,
    });
    if (!credential.identityToken) throw new Error('Apple sign in returned no identity token');
    return { identityToken: credential.identityToken, nonce };
  } catch (error) {
    if (error instanceof Error && (error as { code?: string }).code === 'ERR_REQUEST_CANCELED') {
      throw new SocialSignInCancelled();
    }
    throw error;
  }
}

/**
 * Native Google sign in. `webClientId` is the Google Cloud OAuth web client
 * ID (`EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`) — both platforms need it configured
 * to get back an ID token Supabase's Google provider will accept.
 *
 * Requires `@react-native-google-signin/google-signin` lazily, on the first
 * actual call: that package calls TurboModuleRegistry.getEnforcing at
 * module-load time, which throws immediately in Expo Go or any build the
 * native module hasn't been linked into yet — a top-level import would have
 * crashed the whole sign-in screen (and anything that imports it) before
 * anyone ever pressed the Google button, not just this function. `require`,
 * not `import()`: Metro supports a deferred `require` the same way, and
 * unlike dynamic `import()` it also works under Jest without extra flags.
 */
export async function signInWithGoogle(webClientId: string): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { GoogleSignin } = require('@react-native-google-signin/google-signin');
  GoogleSignin.configure({ webClientId });
  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  const response = await GoogleSignin.signIn();
  if (response.type === 'cancelled') throw new SocialSignInCancelled();
  const idToken = response.data.idToken;
  if (!idToken) throw new Error('Google sign in returned no ID token');
  return idToken;
}
