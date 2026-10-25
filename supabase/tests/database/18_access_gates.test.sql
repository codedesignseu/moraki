-- P0.2: the guardian consents for the baby; everyone else accepts the
-- caregiver agreement. Seeing and sending baby data needs one of the two.
--
-- Household A: 1 owns it (guardian, consent in force); 2 a caregiver who
-- accepted the agreement; 3 a caregiver who hasn't; 4 a caregiver who
-- declared they are a guardian but hasn't consented; 5 a viewer who accepted
-- and then withdrew; 8 a caregiver who accepted an older agreement.
-- Household B: 9 owns it (guardian, consent), so 2's agreement there is
-- about A only. 6 and 7 belong to none; 6 agreed to the Terms, 7 didn't.
begin;
create extension if not exists pgtap with schema extensions;
select plan(55);

insert into auth.users (id, email)
  select ('00000000-0000-0000-0000-00000000000' || n)::uuid, n || '@example.test'
  from generate_series(1, 9) n;
insert into public.households (id, name, created_by) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'A', '00000000-0000-0000-0000-000000000001'),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'B', '00000000-0000-0000-0000-000000000009');
insert into public.memberships (household_id, user_id, role, display_name, is_guardian) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'owner', 'One', true),
  ('aaaaaaaa-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 'caregiver', 'Two', false),
  ('aaaaaaaa-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000003', 'caregiver', 'Three', false),
  ('aaaaaaaa-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000004', 'caregiver', 'Four', true),
  ('aaaaaaaa-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000005', 'viewer', 'Five', false),
  ('aaaaaaaa-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000008', 'caregiver', 'Eight', false),
  ('aaaaaaaa-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000009', 'owner', 'Nine', true);
insert into public.babies (id, household_id, name, born_at) values
  ('bbbbbbbb-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'Ella', now()),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000002', 'Leo', now());
insert into public.events (id, household_id, baby_id, type, occurred_at, payload, created_by, updated_by,
    client_created_at) values
  ('eeeeeeee-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001',
   'bbbbbbbb-0000-0000-0000-000000000001', 'diaper', now(), '{"kind": "wet"}',
   '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', now());
insert into public.consents (user_id, policy_version) values
  ('00000000-0000-0000-0000-000000000001', public.consent_version()),
  ('00000000-0000-0000-0000-000000000009', public.consent_version()),
  -- 4 agreed to the text before P0.2: no longer the one in force.
  ('00000000-0000-0000-0000-000000000004', '2026-10-18');
insert into public.consent_events (user_id, purpose, version, action, text_key, household_id, created_at) values
  ('00000000-0000-0000-0000-000000000002', 'caregiver_agreement', public.caregiver_agreement_version(), 'grant', 'test', 'aaaaaaaa-0000-0000-0000-000000000001', now() - interval '1 day'),
  ('00000000-0000-0000-0000-000000000005', 'caregiver_agreement', public.caregiver_agreement_version(), 'grant', 'test', 'aaaaaaaa-0000-0000-0000-000000000001', now() - interval '2 days'),
  ('00000000-0000-0000-0000-000000000005', 'caregiver_agreement', public.caregiver_agreement_version(), 'withdraw', 'test', 'aaaaaaaa-0000-0000-0000-000000000001', now() - interval '1 day'),
  ('00000000-0000-0000-0000-000000000008', 'caregiver_agreement', '2026-01-01', 'grant', 'test', 'aaaaaaaa-0000-0000-0000-000000000001', now() - interval '1 day'),
  ('00000000-0000-0000-0000-000000000006', 'terms', public.terms_version(), 'grant', 'test', null, now() - interval '1 day');

create function pg_temp.login(n int) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object(
    'sub', ('00000000-0000-0000-0000-00000000000' || n)::uuid, 'role', 'authenticated')::text, true)::void
$$;
create function pg_temp.an_event(n int) returns text language sql as $$
  select format($f$insert into public.events
    (id, household_id, baby_id, type, occurred_at, created_by, updated_by, client_created_at)
    values (gen_random_uuid(), 'aaaaaaaa-0000-0000-0000-000000000001',
            'bbbbbbbb-0000-0000-0000-000000000001', 'diaper', now(), '%s', '%s', now())$f$,
    ('00000000-0000-0000-0000-00000000000' || n)::uuid, ('00000000-0000-0000-0000-00000000000' || n)::uuid)
$$;
create function pg_temp.status(h int) returns text language sql as $$
  select concat_ws('/', status, role, is_guardian, access, baby_name)
  from public.my_membership_status(('aaaaaaaa-0000-0000-0000-00000000000' || h)::uuid)
$$;

-- Who may call what ----------------------------------------------------------
select ok(not has_function_privilege('authenticated', 'public.has_agreed(uuid, text, text, uuid)', 'execute'),
  'has_agreed reads anyone''s answers, so no client may call it');
select ok(not has_function_privilege('anon', 'public.my_membership_status(uuid)', 'execute'),
  'anon can''t ask for a membership status');
select ok(not has_function_privilege('anon', 'public.invite_preview(text)', 'execute'),
  'anon can''t preview an invite');
select hasnt_function('public', 'accept_invite', array['text', 'text', 'text'],
  'the old accept_invite, which joined without the agreement, is gone');
select is(public.terms_version(), '2026-10-24', 'the Terms in force');
select is(public.caregiver_agreement_version(), '2026-10-24', 'the caregiver agreement in force');

set local role authenticated;

-- has_access ---------------------------------------------------------------
select pg_temp.login(1);
select ok(public.has_access('aaaaaaaa-0000-0000-0000-000000000001'), 'a guardian with consent has access');
select ok(not public.has_access('aaaaaaaa-0000-0000-0000-000000000002'), 'but not to another household');
select pg_temp.login(2);
select ok(public.has_access('aaaaaaaa-0000-0000-0000-000000000001'), 'a caregiver who accepted the agreement has access');
select ok(not public.has_access('aaaaaaaa-0000-0000-0000-000000000002'), 'the agreement is for that household only');
select pg_temp.login(3);
select ok(not public.has_access('aaaaaaaa-0000-0000-0000-000000000001'), 'a caregiver who hasn''t accepted has none');
select pg_temp.login(4);
select ok(not public.has_access('aaaaaaaa-0000-0000-0000-000000000001'), 'nor a guardian whose consent is to an older text');
select pg_temp.login(5);
select ok(not public.has_access('aaaaaaaa-0000-0000-0000-000000000001'), 'nor a member who withdrew the agreement');
select pg_temp.login(8);
select ok(not public.has_access('aaaaaaaa-0000-0000-0000-000000000001'), 'nor one who accepted an older agreement');

-- Reading ------------------------------------------------------------------
select pg_temp.login(2);
select isnt_empty('select 1 from public.events', 'events: a caregiver with the agreement reads them');
select is((select count(*)::int from public.memberships), 6, 'memberships: and sees everyone in the household');
select results_eq('select name from public.babies', $$values ('Ella')$$, 'babies: and the baby');
select pg_temp.login(3);
select is_empty('select 1 from public.events', 'events: without the agreement, nothing');
select is_empty('select 1 from public.babies', 'babies: nothing');
select results_eq('select user_id from public.memberships',
  $$values ('00000000-0000-0000-0000-000000000003'::uuid)$$,
  'memberships: only their own row, so the phone knows it is a member');
select results_eq('select name from public.households', $$values ('A')$$,
  'households: the household itself, which holds no baby data');
select pg_temp.login(4);
select is_empty('select 1 from public.events', 'events: a guardian without consent in force reads nothing');

-- Writing ------------------------------------------------------------------
select pg_temp.login(2);
select lives_ok(pg_temp.an_event(2), 'insert: a caregiver with the agreement logs');
select pg_temp.login(3);
select throws_ok(pg_temp.an_event(3), '42501', null, 'insert: refused without the agreement');
select results_eq(
  $$with u as (update public.babies set name = 'X' returning 1) select count(*)::int from u$$,
  array[0], 'babies: no effect without the agreement');
select pg_temp.login(4);
select throws_ok(pg_temp.an_event(4), '42501', null, 'insert: refused for a guardian without consent');

-- Accepting it later (an existing member) ------------------------------------
select pg_temp.login(3);
select throws_ok($$select public.record_consent('caregiver_agreement', public.caregiver_agreement_version(), 'grant')$$,
  '22023', null, 'a caregiver agreement names its household');
select throws_ok($$select public.record_consent('caregiver_agreement', public.caregiver_agreement_version(), 'grant',
  'aaaaaaaa-0000-0000-0000-000000000002')$$,
  '42501', null, 'and only one they are in');
select is(pg_temp.status(1), 'member/caregiver/f/needs_agreement/Ella',
  'my_membership_status: a member asked for the agreement, with the baby''s first name');
select isnt(public.record_consent('caregiver_agreement', public.caregiver_agreement_version(), 'grant',
  'aaaaaaaa-0000-0000-0000-000000000001', 'el'), null, 'the caregiver accepts');
select ok(public.has_access('aaaaaaaa-0000-0000-0000-000000000001'), 'and now has access');
select is(pg_temp.status(1), 'member/caregiver/f/granted/Ella', 'my_membership_status: granted');
select lives_ok(pg_temp.an_event(3), 'and logs');
select pg_temp.login(4);
select is(pg_temp.status(1), 'member/caregiver/t/needs_consent/Ella',
  'my_membership_status: a guardian is asked for consent instead');
select isnt(public.grant_consent('en'), null, 'the guardian consents');
select is(pg_temp.status(1), 'member/caregiver/t/granted/Ella', 'and has access');
select pg_temp.login(6);
select is(pg_temp.status(1), 'not_member', 'my_membership_status: not a member');
select is((select status from public.my_membership_status(gen_random_uuid())), 'household_gone',
  'my_membership_status: no such household');

-- create_household: the Terms and consent first ----------------------------
select pg_temp.login(7);
select throws_ok($$select public.create_household(gen_random_uuid(), gen_random_uuid(), 'Mia',
  now(), 'Seven', guardian_declared => true, guardian_version => '2026-10-24')$$,
  'MK004', null, 'create_household: refused without the Terms');
select isnt(public.record_consent('terms', public.terms_version(), 'grant'), null, 'they agree to the Terms');
select throws_ok($$select public.create_household(gen_random_uuid(), gen_random_uuid(), 'Mia',
  now(), 'Seven', guardian_declared => true, guardian_version => '2026-10-24')$$,
  'MK003', null, 'create_household: refused without health-data consent');
select is_empty($$select 1 from public.memberships where user_id = '00000000-0000-0000-0000-000000000007'$$,
  'and nothing was stored');
select isnt(public.grant_consent(), null, 'they consent');
select lives_ok($$select public.create_household('aaaaaaaa-0000-0000-0000-000000000007', gen_random_uuid(), 'Mia',
  now(), 'Seven', guardian_declared => true, guardian_version => '2026-10-24')$$,
  'create_household: works with both');
select is(pg_temp.status(7), 'member/owner/t/granted/Mia', 'and the creator has access');

-- Previewing and accepting an invite ----------------------------------------
reset role;
insert into public.invites (code, household_id, role, created_by, expires_at) values
  ('PREVJWAB', 'aaaaaaaa-0000-0000-0000-000000000001', 'viewer', '00000000-0000-0000-0000-000000000001', now() + interval '1 day');
set local role authenticated;
select pg_temp.login(6);
select throws_ok($$select * from public.invite_preview('PREVJWAB')$$, 'MKI05', null,
  'invite_preview: counted like a join, so it needs a fresh attempt');
select public.record_invite_attempt();
select results_eq($$select role::text from public.invite_preview('prev-jwab')$$, $$values ('viewer')$$,
  'invite_preview: says the role, and nothing about the household');
select throws_ok($$select * from public.invite_preview('ZZZZZZZZ')$$, 'MKI01', null,
  'invite_preview: an unknown code');
select throws_ok($$select * from public.accept_invite('PREVJWAB', 'Six')$$, 'MKI07', null,
  'accept_invite: refused without the agreement');
select throws_ok($$select * from public.accept_invite('PREVJWAB', 'Six', agreement_version => '2026-01-01')$$,
  'MKI07', null, 'or with an older one');
select is_empty($$select 1 from public.memberships where user_id = '00000000-0000-0000-0000-000000000006'$$,
  'and they did not join');
select results_eq(
  $$select role::text, baby_name from public.accept_invite('PREVJWAB', 'Six', null,
    public.caregiver_agreement_version(), 'el')$$,
  $$values ('viewer', 'Ella')$$, 'accept_invite: joins with the agreement');
select results_eq(
  $$select purpose, version, action, locale, household_id, baby_id from public.consent_events
    where purpose = 'caregiver_agreement'$$,
  $$values ('caregiver_agreement', public.caregiver_agreement_version(), 'grant', 'el',
            'aaaaaaaa-0000-0000-0000-000000000001'::uuid, 'bbbbbbbb-0000-0000-0000-000000000001'::uuid)$$,
  'and the agreement is on record, for that household and baby');
select ok(public.has_access('aaaaaaaa-0000-0000-0000-000000000001'), 'so they see the household');

reset role;
insert into public.invites (code, household_id, role, created_by, expires_at) values
  ('NTERMSAB', 'aaaaaaaa-0000-0000-0000-000000000002', 'caregiver', '00000000-0000-0000-0000-000000000009', now() + interval '1 day');
delete from public.consent_events where user_id = '00000000-0000-0000-0000-000000000007';
delete from public.households where id = 'aaaaaaaa-0000-0000-0000-000000000007';
set local role authenticated;
select pg_temp.login(7);
select public.record_invite_attempt();
select throws_ok($$select * from public.accept_invite('NTERMSAB', 'Seven', null,
  public.caregiver_agreement_version())$$, 'MKI06', null, 'accept_invite: refused without the Terms');

select * from finish();
rollback;
