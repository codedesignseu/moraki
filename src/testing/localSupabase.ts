/// <reference types="node" />
// Test-only, for `npm run test:local`: signing in against a running local
// Supabase with the real emailed code, read from the local mail catcher.
import { newId } from '@/domain/ids';
import { createAuth } from '@/sync/auth';

import { keychain } from './fakeSupabaseAuth';

export const LOCAL_ENABLED = process.env.MORAKI_LOCAL_SUPABASE === '1';
export const LOCAL_ENV = {
  url: process.env.MORAKI_LOCAL_API_URL ?? 'http://127.0.0.1:55321',
  publishableKey: process.env.MORAKI_LOCAL_PUBLISHABLE_KEY ?? '',
};
const MAIL = process.env.MORAKI_LOCAL_MAIL_URL ?? 'http://127.0.0.1:55324';

export const newUuid = () => newId(Date.now(), () => crypto.getRandomValues(new Uint8Array(16)));

/** The code Supabase just emailed, whatever length the project sends. */
export async function codeSentTo(email: string): Promise<string> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const search = await fetch(`${MAIL}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`);
    const { messages } = (await search.json()) as { messages: { ID: string }[] };
    if (messages[0]) {
      const message = await fetch(`${MAIL}/api/v1/message/${messages[0].ID}`);
      const { Text, HTML } = (await message.json()) as { Text: string; HTML: string };
      const code = /\b(\d{6,10})\b/.exec(Text || HTML)?.[1];
      if (code) return code;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error('no code arrived');
}

/**
 * A phone: its own keychain and client, signed in as its own new user, with
 * consent given. Nothing writes health data without it (P3-09), so a phone
 * that skipped this step would have every push rejected by the database.
 */
export async function phone(label: string) {
  const email = `${label}-${Date.now()}@example.test`;
  const auth = createAuth(LOCAL_ENV, keychain().store);
  await auth.requestCode(email);
  const user = await auth.verifyCode(email, await codeSentTo(email));
  auth.setForeground(false);
  const { error } = await auth.client.rpc('grant_consent');
  if (error) throw new Error(`grant_consent failed: ${error.code ?? 'no code'}`);
  return { auth, user };
}
