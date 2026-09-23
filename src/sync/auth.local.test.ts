// Opt-in: `npm run test:local` against `supabase start` (jest.local.config.js).
// The main suite ignores *.local.test.ts. Real Supabase Auth, a real emailed code read
// from the local mail server, and the RLS helpers seeing the signed-in user.
import { createAuth } from './auth';
import { createHousehold, findHousehold } from './household';
import { acceptInvite, createInvite, inviteLink, normaliseCode } from './invites';
import { newId } from '@/domain/ids';
import { keychain } from '@/testing/fakeSupabaseAuth';
import {
  codeSentTo,
  LOCAL_ENABLED as enabled,
  LOCAL_ENV,
  newUuid,
  phone,
} from '@/testing/localSupabase';

(enabled ? describe : describe.skip)('email OTP against local Supabase', () => {
  jest.setTimeout(60_000);

  it('signs in with the emailed code, survives a restart, auth.uid() is the user, and sets up a household', async () => {
    const env = LOCAL_ENV;
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

    // P2-05: a new user creates their household and ends with an empty baby.
    const created = await createHousehold(
      reopened,
      user.id,
      {
        babyName: ' Ella ',
        bornAt: Date.parse('2026-10-26T10:00:00Z'),
        birthWeightG: 3400,
        displayName: 'Maria',
        relation: 'mother',
      },
      () => newId(Date.now(), () => crypto.getRandomValues(new Uint8Array(16))),
    );
    const babies = await client
      .from('babies')
      .select('id, name, household_id, born_at, birth_weight_g');
    expect(babies.data).toEqual([
      {
        id: created.babyId,
        name: 'Ella',
        household_id: created.householdId,
        born_at: '2026-10-26T10:00:00+00:00',
        birth_weight_g: 3400,
      },
    ]);
    const events = await client.from('events').select('id').eq('baby_id', created.babyId);
    expect(events).toMatchObject({ data: [], error: null });
    const owner = await client.rpc('is_owner', { h: created.householdId });
    expect(owner).toMatchObject({ data: true, error: null });
    const members = await client
      .from('memberships')
      .select('user_id, role, display_name, relation');
    expect(members.data).toEqual([
      { user_id: user.id, role: 'owner', display_name: 'Maria', relation: 'mother' },
    ]);
    // A reinstall finds it rather than making another.
    expect(await findHousehold(reopened, user.id)).toEqual(created);

    await reopened.signOut();
    expect(await reopened.currentUser()).toBeNull();
    reopened.setForeground(false);
  });

  it('a second phone joins through the invite link, with the role it granted', async () => {
    // Phone A: the owner sets up the household and invites a caregiver.
    const a = await phone('owner');
    const household = await createHousehold(
      a.auth,
      a.user.id,
      {
        babyName: 'Ella',
        bornAt: Date.parse('2026-10-26T10:00:00Z'),
        birthWeightG: null,
        displayName: 'Maria',
        relation: 'mother',
      },
      newUuid,
    );
    const invite = await createInvite(a.auth, household.householdId, 'caregiver');
    expect(invite.code).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{8}$/);
    expect(invite.expiresAt).toBeGreaterThan(Date.now());

    // Phone B: opens the link, reads the code from it, and joins.
    const b = await phone('carer');
    const fromLink = normaliseCode(inviteLink(invite.code).split('/join/')[1]!);
    const joined = await acceptInvite(b.auth, fromLink, 'Nik', 'father');
    expect(joined).toEqual({
      householdId: household.householdId,
      role: 'caregiver',
      babyId: household.babyId,
      babyName: 'Ella',
    });
    // findHousehold reads the baby's birth details too, which the invite
    // answer doesn't carry (P3-05).
    expect(await findHousehold(b.auth, b.user.id)).toEqual({
      userId: b.user.id,
      ...joined,
      bornAt: Date.parse('2026-10-26T10:00:00Z'),
      birthWeightG: null,
    });

    // The role is real: B can log, and A sees it.
    const logged = await b.auth.client.from('events').insert({
      id: newUuid(),
      household_id: household.householdId,
      baby_id: household.babyId,
      type: 'diaper',
      occurred_at: new Date().toISOString(),
      payload: { kind: 'wet' },
      created_by: b.user.id,
      updated_by: b.user.id,
      client_created_at: new Date().toISOString(),
    });
    expect(logged.error).toBeNull();
    const seenByOwner = await a.auth.client.from('events').select('created_by');
    expect(seenByOwner.data).toEqual([{ created_by: b.user.id }]);

    // The code is single use, and a viewer invite grants reading only.
    const c = await phone('viewer');
    await expect(acceptInvite(c.auth, invite.code, 'Late', null)).rejects.toMatchObject({
      reason: 'used',
    });
    const viewerInvite = await createInvite(a.auth, household.householdId, 'viewer');
    expect(await acceptInvite(c.auth, viewerInvite.code, 'Yiayia', 'grandparent')).toMatchObject({
      role: 'viewer',
    });
    const refused = await c.auth.client.from('events').insert({
      id: newUuid(),
      household_id: household.householdId,
      baby_id: household.babyId,
      type: 'diaper',
      occurred_at: new Date().toISOString(),
      payload: { kind: 'wet' },
      created_by: c.user.id,
      updated_by: c.user.id,
      client_created_at: new Date().toISOString(),
    });
    expect(refused.error?.code).toBe('42501');
    const seenByViewer = await c.auth.client.from('events').select('id');
    expect(seenByViewer.data).toHaveLength(1);

    for (const p of [a, b, c]) {
      await p.auth.signOut();
      p.auth.setForeground(false);
    }
  });
});
