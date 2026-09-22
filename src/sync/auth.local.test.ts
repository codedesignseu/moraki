// Opt-in: `npm run test:local` against `supabase start` (jest.local.config.js).
// The main suite ignores *.local.test.ts. Real Supabase Auth, a real emailed code read
// from the local mail server, and the RLS helpers seeing the signed-in user.
import { createAuth } from './auth';
import { keychain } from '@/testing/fakeSupabaseAuth';

const enabled = process.env.MORAKI_LOCAL_SUPABASE === '1';
const API = process.env.MORAKI_LOCAL_API_URL ?? 'http://127.0.0.1:55321';
const MAIL = process.env.MORAKI_LOCAL_MAIL_URL ?? 'http://127.0.0.1:55324';
const KEY = process.env.MORAKI_LOCAL_PUBLISHABLE_KEY ?? '';

async function codeSentTo(email: string): Promise<string> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const search = await fetch(`${MAIL}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`);
    const { messages } = (await search.json()) as { messages: { ID: string }[] };
    if (messages[0]) {
      const message = await fetch(`${MAIL}/api/v1/message/${messages[0].ID}`);
      const { Text, HTML } = (await message.json()) as { Text: string; HTML: string };
      const code = /\b(\d{6})\b/.exec(Text || HTML)?.[1];
      if (code) return code;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error('no code arrived');
}

(enabled ? describe : describe.skip)('email OTP against local Supabase', () => {
  jest.setTimeout(30_000);

  it('signs in with the emailed code, survives a restart, and auth.uid() is the user', async () => {
    const env = { url: API, publishableKey: KEY };
    const email = `p2-04-${Date.now()}@example.test`;
    const { store } = keychain();

    const auth = createAuth(env, store);
    await auth.requestCode(email);
    const code = await codeSentTo(email);
    const user = await auth.verifyCode(email, code);
    expect(user.email).toBe(email);
    auth.setForeground(false);

    // Relaunch: a new client from the same keychain.
    const reopened = createAuth(env, store);
    expect(await reopened.currentUser()).toEqual(user);

    // The server sees that user: RLS lets them create a household in their
    // own name only, and the P2-02 helpers answer for them.
    const client = reopened.client;
    const mine = await client
      .from('households')
      .insert({ id: crypto.randomUUID(), name: 'h', created_by: user.id });
    expect(mine.error).toBeNull();
    const theirs = await client
      .from('households')
      .insert({ id: crypto.randomUUID(), name: 'h', created_by: crypto.randomUUID() });
    expect(theirs.error?.code).toBe('42501');
    const member = await client.rpc('is_member', { h: crypto.randomUUID() });
    expect(member).toMatchObject({ data: false, error: null });

    await reopened.signOut();
    expect(await reopened.currentUser()).toBeNull();
    reopened.setForeground(false);
  });
});
