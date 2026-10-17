import { generateKeyPairSync, webcrypto, createPublicKey, verify as nodeVerify } from 'node:crypto';

import {
  APPLE_REVOKE_URL,
  APPLE_TOKEN_URL,
  buildClientSecret,
  parseBody,
  readConfig,
  revokeWithCode,
  type AppleConfig,
} from './apple';

const subtle = webcrypto.subtle as unknown as SubtleCrypto;
const NOW = 1_790_000_000;

const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
const config: AppleConfig = {
  teamId: 'TEAMID1234',
  keyId: 'KEYID12345',
  clientId: 'eu.codedesigns.moraki',
  privateKeyPem: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
};

const decode = (part: string) =>
  JSON.parse(Buffer.from(part, 'base64url').toString('utf8')) as Record<string, unknown>;

describe('the Apple client secret', () => {
  it('is an ES256 JWT with the key ID, team, bundle ID and Apple audience, valid five minutes', async () => {
    const jwt = await buildClientSecret(config, NOW, subtle);
    const [header, payload, signature] = jwt.split('.') as [string, string, string];
    expect(decode(header)).toEqual({ alg: 'ES256', kid: 'KEYID12345', typ: 'JWT' });
    expect(decode(payload)).toEqual({
      iss: 'TEAMID1234',
      iat: NOW,
      exp: NOW + 300,
      aud: 'https://appleid.apple.com',
      sub: 'eu.codedesigns.moraki',
    });
    // The signature is raw r||s (64 bytes), as JWS wants, and verifies with the public key.
    const raw = Buffer.from(signature, 'base64url');
    expect(raw).toHaveLength(64);
    const ok = nodeVerify(
      'sha256',
      Buffer.from(`${header}.${payload}`),
      {
        key: createPublicKey(publicKey.export({ type: 'spki', format: 'pem' })),
        dsaEncoding: 'ieee-p1363',
      },
      raw,
    );
    expect(ok).toBe(true);
  });

  it('accepts a key pasted with literal \\n sequences', async () => {
    const flattened = { ...config, privateKeyPem: config.privateKeyPem.replace(/\n/g, '\\n') };
    await expect(buildClientSecret(flattened, NOW, subtle)).resolves.toMatch(
      /^[\w-]+\.[\w-]+\.[\w-]+$/,
    );
  });
});

describe('settings and input', () => {
  it('needs all four secrets', () => {
    const env: Record<string, string> = {
      APPLE_TEAM_ID: 'T',
      APPLE_KEY_ID: 'K',
      APPLE_CLIENT_ID: 'C',
      APPLE_PRIVATE_KEY: 'P',
    };
    expect(readConfig((name) => env[name])).toEqual({
      teamId: 'T',
      keyId: 'K',
      clientId: 'C',
      privateKeyPem: 'P',
    });
    expect(readConfig((name) => (name === 'APPLE_KEY_ID' ? ' ' : env[name]))).toBeNull();
  });

  it('takes a non-empty authorizationCode string only', () => {
    expect(parseBody({ authorizationCode: 'abc' })).toBe('abc');
    expect(parseBody({ authorizationCode: '' })).toBeNull();
    expect(parseBody({ authorizationCode: 1 })).toBeNull();
    expect(parseBody(null)).toBeNull();
    expect(parseBody({ authorizationCode: 'x'.repeat(2000) })).toBeNull();
  });
});

type Sent = { url: string; form: Record<string, string> };
function apple(answers: { token: () => Response; revoke?: () => Response }) {
  const sent: Sent[] = [];
  const fetchImpl = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    sent.push({ url, form: Object.fromEntries(new URLSearchParams(String(init?.body))) });
    if (url === APPLE_TOKEN_URL) return answers.token();
    if (url === APPLE_REVOKE_URL) return answers.revoke?.() ?? new Response(null, { status: 200 });
    throw new Error(`unexpected ${url}`);
  }) as unknown as typeof fetch;
  return { fetch: fetchImpl, sent };
}
const json = (status: number, value: unknown) =>
  new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } });

describe('revoking with an authorization code', () => {
  it('exchanges the code, then revokes the refresh token', async () => {
    const { fetch, sent } = apple({
      token: () => json(200, { access_token: 'AT', refresh_token: 'RT', id_token: 'x' }),
    });
    await expect(
      revokeWithCode('CODE', config, { fetch, subtle, nowSeconds: NOW }),
    ).resolves.toEqual({
      revoked: true,
    });
    expect(sent.map((s) => s.url)).toEqual([APPLE_TOKEN_URL, APPLE_REVOKE_URL]);
    expect(sent[0]?.form).toMatchObject({
      client_id: 'eu.codedesigns.moraki',
      code: 'CODE',
      grant_type: 'authorization_code',
    });
    expect(sent[0]?.form.client_secret).toMatch(/^[\w-]+\.[\w-]+\.[\w-]+$/);
    expect(sent[1]?.form).toMatchObject({
      client_id: 'eu.codedesigns.moraki',
      token: 'RT',
      token_type_hint: 'refresh_token',
    });
  });

  it('falls back to the access token when Apple returns no refresh token', async () => {
    const { fetch, sent } = apple({ token: () => json(200, { access_token: 'AT' }) });
    await expect(
      revokeWithCode('CODE', config, { fetch, subtle, nowSeconds: NOW }),
    ).resolves.toEqual({
      revoked: true,
    });
    expect(sent[1]?.form).toMatchObject({ token: 'AT', token_type_hint: 'access_token' });
  });

  it('reports a used or expired code without calling revoke', async () => {
    const { fetch, sent } = apple({ token: () => json(400, { error: 'invalid_grant' }) });
    await expect(
      revokeWithCode('CODE', config, { fetch, subtle, nowSeconds: NOW }),
    ).resolves.toEqual({
      revoked: false,
      error: 'invalid_code',
    });
    expect(sent).toHaveLength(1);
  });

  it('reports a refused client secret', async () => {
    const { fetch } = apple({ token: () => json(400, { error: 'invalid_client' }) });
    await expect(
      revokeWithCode('CODE', config, { fetch, subtle, nowSeconds: NOW }),
    ).resolves.toEqual({
      revoked: false,
      error: 'apple_rejected',
    });
  });

  it('reports Apple being unreachable, or failing on revoke', async () => {
    const down = apple({
      token: () => {
        throw new TypeError('network');
      },
    });
    await expect(
      revokeWithCode('CODE', config, { fetch: down.fetch, subtle, nowSeconds: NOW }),
    ).resolves.toEqual({ revoked: false, error: 'apple_unreachable' });

    const refused = apple({
      token: () => json(200, { refresh_token: 'RT' }),
      revoke: () => json(400, { error: 'invalid_request' }),
    });
    await expect(
      revokeWithCode('CODE', config, { fetch: refused.fetch, subtle, nowSeconds: NOW }),
    ).resolves.toEqual({ revoked: false, error: 'apple_rejected' });
  });

  it('reports a key it cannot read without sending anything', async () => {
    const { fetch, sent } = apple({ token: () => json(200, {}) });
    await expect(
      revokeWithCode(
        'CODE',
        { ...config, privateKeyPem: 'not a key' },
        { fetch, subtle, nowSeconds: NOW },
      ),
    ).resolves.toEqual({ revoked: false, error: 'apple_rejected' });
    expect(sent).toEqual([]);
  });
});
