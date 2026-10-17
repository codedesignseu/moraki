import * as AppleAuthentication from 'expo-apple-authentication';

/**
 * Asks the person to confirm with Apple once more before their account is
 * deleted (App Store guideline 5.1.1(v)). No scopes: only the fresh
 * `authorizationCode` is wanted, which the `apple-revoke` Edge Function
 * exchanges and revokes. The code is valid for five minutes and is used once.
 *
 * Returns `null` when the person closes the sheet.
 */
export async function confirmWithApple(): Promise<string | null> {
  try {
    const credential = await AppleAuthentication.signInAsync({ requestedScopes: [] });
    if (!credential.authorizationCode) throw new Error('Apple returned no authorization code');
    return credential.authorizationCode;
  } catch (error) {
    if (error instanceof Error && (error as { code?: string }).code === 'ERR_REQUEST_CANCELED') {
      return null;
    }
    throw error;
  }
}
