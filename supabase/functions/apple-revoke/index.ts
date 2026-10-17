// Supabase Edge Function (Deno): revokes the caller's Sign in with Apple
// tokens before their account is deleted (App Store guideline 5.1.1(v)).
//
// POST { authorizationCode } with the caller's Supabase session as the
// bearer token. Answers { revoked: true }, or { error: <code> } with a 4xx/5xx.
// Never logs the code, Apple's tokens, the key or the caller's email.
//
// Secrets (set by the owner, see docs/10-release-runbook.md):
//   APPLE_TEAM_ID, APPLE_KEY_ID, APPLE_CLIENT_ID, APPLE_PRIVATE_KEY
import { createClient } from 'jsr:@supabase/supabase-js@2.117.0';

import { parseBody, readConfig, revokeWithCode } from './apple.ts';

const json = (status: number, value: unknown) =>
  new Response(JSON.stringify(value), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

Deno.serve(async (request) => {
  if (request.method !== 'POST') return json(405, { error: 'method_not_allowed' });

  const authorization = request.headers.get('Authorization') ?? '';
  const jwt = authorization.replace(/^Bearer\s+/i, '');
  if (!jwt || jwt === authorization) return json(401, { error: 'unauthorized' });

  const url = Deno.env.get('SUPABASE_URL');
  // Only used to ask Supabase Auth whose session this is; the caller's own
  // token decides the answer. Both are set by the Edge Runtime itself.
  const key = Deno.env.get('SUPABASE_ANON_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) return json(500, { error: 'not_configured' });
  const supabase = createClient(url, key, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await supabase.auth.getUser(jwt);
  if (error || !data.user) return json(401, { error: 'unauthorized' });

  const code = parseBody(await request.json().catch(() => null));
  if (!code) return json(400, { error: 'bad_request' });

  const config = readConfig((name) => Deno.env.get(name));
  if (!config) {
    console.error('apple-revoke: Apple secrets are not set');
    return json(500, { error: 'not_configured' });
  }

  const result = await revokeWithCode(code, config, {
    fetch,
    subtle: crypto.subtle,
    nowSeconds: Math.floor(Date.now() / 1000),
  });
  if (result.revoked) return json(200, { revoked: true });
  // The failure code only: no Apple response body, which can name the person.
  console.error(`apple-revoke: ${result.error}`);
  return json(result.error === 'apple_unreachable' ? 502 : 400, { error: result.error });
});
