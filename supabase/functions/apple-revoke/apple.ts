/**
 * Sign in with Apple token revocation (App Store guideline 5.1.1(v)).
 *
 * Pure apart from what is passed in (`fetch`, WebCrypto's `subtle`, the
 * time), so it runs under Deno in the Edge Function and under Jest in the
 * app's test run. Nothing here logs: the code, the tokens and the private key
 * never leave these functions except in the requests to Apple.
 */

export const APPLE_AUDIENCE = 'https://appleid.apple.com';
export const APPLE_TOKEN_URL = 'https://appleid.apple.com/auth/token';
export const APPLE_REVOKE_URL = 'https://appleid.apple.com/auth/revoke';
/** Apple accepts up to six months; five minutes is all one request needs. */
export const CLIENT_SECRET_LIFETIME_S = 300;

export type AppleConfig = {
  /** Apple Developer Team ID (`iss`). */
  teamId: string;
  /** The Sign in with Apple key's ID (`kid`). */
  keyId: string;
  /** The app's bundle ID, which is the client ID for native sign in (`sub`). */
  clientId: string;
  /** The key's .p8 file, PEM, PKCS#8. */
  privateKeyPem: string;
};

/** Why revocation failed, without any detail from Apple that could identify someone. */
export type RevokeFailure =
  | 'invalid_code' // Apple refused the authorization code (expired, used, or for another app).
  | 'apple_rejected' // Apple refused the client secret or the revoke request.
  | 'apple_unreachable'; // No answer from Apple.

export type RevokeResult = { revoked: true } | { revoked: false; error: RevokeFailure };

/** Reads the four settings from the environment; null if any is missing or blank. */
export function readConfig(get: (name: string) => string | undefined): AppleConfig | null {
  const teamId = get('APPLE_TEAM_ID')?.trim();
  const keyId = get('APPLE_KEY_ID')?.trim();
  const clientId = get('APPLE_CLIENT_ID')?.trim();
  const privateKeyPem = get('APPLE_PRIVATE_KEY')?.trim();
  if (!teamId || !keyId || !clientId || !privateKeyPem) return null;
  return { teamId, keyId, clientId, privateKeyPem };
}

/** The request body the function accepts: `{ authorizationCode }`, a non-empty string. */
export function parseBody(body: unknown): string | null {
  if (typeof body !== 'object' || body === null) return null;
  const code = (body as { authorizationCode?: unknown }).authorizationCode;
  if (typeof code !== 'string') return null;
  const trimmed = code.trim();
  return trimmed.length > 0 && trimmed.length <= 1024 ? trimmed : null;
}

function base64UrlFromBytes(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function base64UrlFromJson(value: unknown): string {
  return base64UrlFromBytes(new TextEncoder().encode(JSON.stringify(value)));
}

/** The DER bytes inside a PEM block; tolerates `\n` written as two characters by a shell. */
export function pemToDer(pem: string): ArrayBuffer {
  const body = pem
    .replace(/\\n/g, '\n')
    .replace(/-----(BEGIN|END) [A-Z ]+-----/g, '')
    .replace(/\s+/g, '');
  if (body.length === 0) throw new Error('empty key');
  const binary = atob(body);
  const der = new ArrayBuffer(binary.length);
  const bytes = new Uint8Array(der);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return der;
}

/**
 * The client secret Apple's token endpoints want: an ES256 JWT signed with
 * the Sign in with Apple key. WebCrypto's ECDSA signature is already the raw
 * r||s form JWS uses, so no DER conversion is needed.
 */
export async function buildClientSecret(
  config: AppleConfig,
  nowSeconds: number,
  subtle: SubtleCrypto,
): Promise<string> {
  const header = { alg: 'ES256', kid: config.keyId, typ: 'JWT' };
  const payload = {
    iss: config.teamId,
    iat: nowSeconds,
    exp: nowSeconds + CLIENT_SECRET_LIFETIME_S,
    aud: APPLE_AUDIENCE,
    sub: config.clientId,
  };
  const signingInput = `${base64UrlFromJson(header)}.${base64UrlFromJson(payload)}`;
  const key = await subtle.importKey(
    'pkcs8',
    pemToDer(config.privateKeyPem),
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign'],
  );
  const signature = await subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    key,
    new TextEncoder().encode(signingInput),
  );
  return `${signingInput}.${base64UrlFromBytes(new Uint8Array(signature))}`;
}

async function postForm(
  fetchImpl: typeof fetch,
  url: string,
  form: Record<string, string>,
): Promise<Response | null> {
  try {
    return await fetchImpl(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(form).toString(),
    });
  } catch {
    return null;
  }
}

/**
 * Exchanges the authorization code for tokens, then revokes the refresh
 * token (or the access token, if Apple returned no refresh token).
 */
export async function revokeWithCode(
  authorizationCode: string,
  config: AppleConfig,
  deps: { fetch: typeof fetch; subtle: SubtleCrypto; nowSeconds: number },
): Promise<RevokeResult> {
  let clientSecret: string;
  try {
    clientSecret = await buildClientSecret(config, deps.nowSeconds, deps.subtle);
  } catch {
    return { revoked: false, error: 'apple_rejected' };
  }
  const client = { client_id: config.clientId, client_secret: clientSecret };

  const exchanged = await postForm(deps.fetch, APPLE_TOKEN_URL, {
    ...client,
    code: authorizationCode,
    grant_type: 'authorization_code',
  });
  if (!exchanged) return { revoked: false, error: 'apple_unreachable' };
  if (!exchanged.ok) {
    const body = (await exchanged.json().catch(() => ({}))) as { error?: unknown };
    if (exchanged.status >= 500) return { revoked: false, error: 'apple_unreachable' };
    return {
      revoked: false,
      error: body.error === 'invalid_grant' ? 'invalid_code' : 'apple_rejected',
    };
  }
  const tokens = (await exchanged.json().catch(() => ({}))) as {
    refresh_token?: unknown;
    access_token?: unknown;
  };
  const [token, hint] =
    typeof tokens.refresh_token === 'string' && tokens.refresh_token
      ? [tokens.refresh_token, 'refresh_token']
      : typeof tokens.access_token === 'string' && tokens.access_token
        ? [tokens.access_token, 'access_token']
        : [null, null];
  if (!token || !hint) return { revoked: false, error: 'apple_rejected' };

  const revoked = await postForm(deps.fetch, APPLE_REVOKE_URL, {
    ...client,
    token,
    token_type_hint: hint,
  });
  if (!revoked) return { revoked: false, error: 'apple_unreachable' };
  if (revoked.status >= 500) return { revoked: false, error: 'apple_unreachable' };
  if (!revoked.ok) return { revoked: false, error: 'apple_rejected' };
  return { revoked: true };
}
